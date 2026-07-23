// Shared "boundary protection" primitives: keep a paint stroke inside the
// closed region of a line layer it starts in. Reached through
// useBoundaryProtection, which is how every coloring mode uses them.

// A line pixel counts as a "wall" (a boundary a protected stroke can't cross)
// once its rendered alpha clears this threshold — low enough that antialiased
// edges stay continuous across even thin lines.
export const WALL_ALPHA = 60

// A protected stroke bleeds this many *mask* pixels under the line edges,
// expanding only across wall pixels, so no white slivers are left uncoloured
// along the lines. Kept small so it can't bridge a thin line.
export const EDGE_BLEED = 3

// The region computation (mask read, flood, bleed, clip) runs at this resolution
// cap rather than the retina device resolution, then the clip is scaled back up
// when compositing. Templates are saved at <=1000px and the colour brush is
// chunky, so there is no wall detail beyond this to preserve — but on a 2x/3x
// canvas it is 4-9x fewer pixels through every per-stroke pass, which is what
// made coloring a loaded template lag on iPad. Verified on real templates: walls
// still seal at this resolution (no region leaks across a line).
export const PROTECT_MAX_DIM = 1024

export type WallMask = {
  w: number // mask resolution (capped), what flood/bleed/clip run at
  h: number
  srcW: number // the source canvas size the mask was derived from
  srcH: number
  data: Uint8Array // 1 = wall (line), 0 = paintable
  hasWall: boolean
}

// Build a wall mask from a canvas' own pixels (e.g. a loaded template layer),
// downscaled so its longest side is at most `maxDim`. Downscaling averages a
// line's coverage into the alpha, and WALL_ALPHA is low enough that the softened
// edges still read as wall — so regions stay sealed while the mask (and every
// pass over it) shrinks with the square of the scale.
export function wallMaskFromCanvas(
  canvas: HTMLCanvasElement,
  maxDim = Infinity
): WallMask | null {
  const srcW = canvas.width
  const srcH = canvas.height
  if (srcW === 0 || srcH === 0) return null
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH))
  const w = Math.max(1, Math.round(srcW * scale))
  const h = Math.max(1, Math.round(srcH * scale))

  let px: Uint8ClampedArray
  if (scale === 1) {
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    px = ctx.getImageData(0, 0, w, h).data
  } else {
    const off = document.createElement("canvas")
    off.width = w
    off.height = h
    const octx = off.getContext("2d")
    if (!octx) return null
    octx.drawImage(canvas, 0, 0, w, h)
    px = octx.getImageData(0, 0, w, h).data
  }

  const data = new Uint8Array(w * h)
  let hasWall = false
  for (let i = 0; i < data.length; i++)
    if (px[i * 4 + 3] >= WALL_ALPHA) {
      data[i] = 1
      hasWall = true
    }
  return { w, h, srcW, srcH, data, hasWall }
}

// The four orthogonal neighbours of pixel `i`, written into `out` as indices,
// with -1 where the grid edge ends the walk.
//
// `wrap` makes the grid a torus: the left/right and top/bottom edges are the
// same seam, so a walk that leaves one edge continues on the opposite one. Modes
// whose pattern repeats past the canvas border (tiles) need this — a region that
// straddles the border is one region, drawn as two halves at opposite edges.
function neighbors(
  i: number,
  w: number,
  n: number,
  wrap: boolean,
  out: Int32Array
) {
  const x = i % w
  out[0] = x > 0 ? i - 1 : wrap ? i + w - 1 : -1
  out[1] = x < w - 1 ? i + 1 : wrap ? i - w + 1 : -1
  out[2] = i >= w ? i - w : wrap ? i + n - w : -1
  out[3] = i < n - w ? i + w : wrap ? i - n + w : -1
}

// Flood the closed region containing `start` directly into a shared `union`
// mask, marking every reached pixel. Returns true if it filled anything (false
// if `start` is a wall or was already covered by a prior flood). Use this to
// union several seeds' regions without allocating and merging a mask per seed.
//
// Every reached pixel that touches a wall is appended to `frontier` — that is
// exactly where bleedUnderLines starts from, and the flood already looks at
// every neighbour of every region pixel, so collecting it here costs nothing
// and saves the bleed a scan of the whole canvas to rediscover it.
export function floodInto(
  union: Uint8Array,
  wall: Uint8Array,
  w: number,
  h: number,
  start: number,
  frontier: number[],
  wrap = false
): boolean {
  if (wall[start] || union[start]) return false
  const n = w * h
  const stack = [start]
  const nb = new Int32Array(4)
  union[start] = 1
  while (stack.length) {
    // Each pixel is stacked once (union marks it at push time), so it is popped
    // once and lands in `frontier` at most once.
    const i = stack.pop()!
    neighbors(i, w, n, wrap, nb)
    let touchesWall = false
    for (let k = 0; k < 4; k++) {
      const j = nb[k]
      if (j < 0) continue
      if (wall[j]) touchesWall = true
      else if (!union[j]) (union[j] = 1), stack.push(j)
    }
    if (touchesWall) frontier.push(i)
  }
  return true
}

// Grow the flooded region outward by `bleed` pixels, but only across wall pixels
// — so paint slides under the antialiased line edge yet can never reach the
// fillable interior of an adjacent region. `frontier` is the region's
// wall-touching edge, as collected by floodInto.
//
// Expands `union` in place: it only ever adds wall pixels, which the flood never
// reaches, so there is nothing for this to trample.
export function bleedUnderLines(
  union: Uint8Array,
  wall: Uint8Array,
  w: number,
  h: number,
  bleed: number,
  frontier: number[],
  wrap = false
) {
  const n = w * h
  const nb = new Int32Array(4)
  let edge = frontier
  for (let step = 0; step < bleed && edge.length; step++) {
    const next: number[] = []
    for (const i of edge) {
      neighbors(i, w, n, wrap, nb)
      for (let k = 0; k < 4; k++) {
        const j = nb[k]
        if (j >= 0 && !union[j] && wall[j]) (union[j] = 1), next.push(j)
      }
    }
    edge = next
  }
}

// A canvas that is opaque where `mask` is set and transparent elsewhere; use it
// as a destination-in clip to keep a stroke inside the mask.
export function buildClipCanvas(
  mask: Uint8Array,
  w: number,
  h: number
): HTMLCanvasElement {
  const clip = document.createElement("canvas")
  clip.width = w
  clip.height = h
  const img = new ImageData(w, h)
  // Opaque white is 0xff in every channel, so a pixel is one 32-bit store
  // rather than four byte stores — and being all-0xff, endianness is moot.
  const px = new Uint32Array(img.data.buffer)
  for (let i = 0; i < mask.length; i++) if (mask[i]) px[i] = 0xffffffff
  clip.getContext("2d")!.putImageData(img, 0, 0)
  return clip
}

// Device-pixel rectangle a stamp touches, used to bound per-move work.
export type Bbox = { minX: number; minY: number; maxX: number; maxY: number }

// A stroke that stays inside a region without recompositing the whole canvas on
// every move. Each `paint` clips the just-drawn stamp(s) to the region and
// composites only their bounding box onto the color layer, so cost scales with
// the brush movement — not with the (retina-sized) canvas.
//
// `clip` is opaque inside the region and transparent outside; `dpr` matches the
// color context's transform. `clipScale` maps a device pixel to the clip's own
// (capped) resolution — 1 when the clip is device-sized. Strokes must be opaque
// (solid colors), since each stamp is painted straight onto the color layer
// rather than accumulated.
export type ClippedStroke = {
  // `stamp` draws the segment(s) in CSS coordinates onto the provided context
  // (the mode's usual stampOn). `bbox` is the device-pixel region they cover.
  paint(stamp: (ctx: CanvasRenderingContext2D) => void, bbox: Bbox): void
}

export function beginClippedStroke(
  colorCtx: CanvasRenderingContext2D,
  clip: HTMLCanvasElement,
  dpr: number,
  clipScale = 1
): ClippedStroke {
  // The color layer is device-sized; the clip may be smaller (see clipScale).
  const deviceW = colorCtx.canvas.width
  const deviceH = colorCtx.canvas.height

  // A scratch layer, grown to the largest bbox seen, where each stamp is drawn
  // and clipped in isolation before being composited onto the color layer.
  const scratch = document.createElement("canvas")
  const sctx = scratch.getContext("2d")!

  // Round caps and joins are what make a stroke read as one smooth line rather
  // than a segment's bare rectangle. Resizing a canvas resets its context to
  // the defaults (butt/miter), so this has to be reapplied after every grow —
  // not just once up front.
  const shapeBrush = () => {
    sctx.lineCap = "round"
    sctx.lineJoin = "round"
  }
  shapeBrush()

  return {
    paint(stamp, bbox) {
      const minX = Math.max(0, Math.floor(bbox.minX))
      const minY = Math.max(0, Math.floor(bbox.minY))
      const maxX = Math.min(deviceW, Math.ceil(bbox.maxX))
      const maxY = Math.min(deviceH, Math.ceil(bbox.maxY))
      const bw = maxX - minX
      const bh = maxY - minY
      if (bw <= 0 || bh <= 0) return

      let grew = false
      if (scratch.width < bw) (scratch.width = bw), (grew = true)
      if (scratch.height < bh) (scratch.height = bh), (grew = true)
      if (grew) shapeBrush()

      // Draw the stamp(s), offset so device (minX,minY) maps to the scratch
      // origin, at the same dpr scale the mode draws with.
      sctx.setTransform(1, 0, 0, 1, 0, 0)
      sctx.clearRect(0, 0, bw, bh)
      sctx.setTransform(dpr, 0, 0, dpr, -minX, -minY)
      stamp(sctx)

      // Clip to the region: keep scratch pixels only where the region is opaque.
      // The clip is at its own resolution, so sample the matching sub-rect
      // (clipScale maps device px -> clip px) and let drawImage scale it up to
      // the device-sized scratch — its soft edge stays within EDGE_BLEED.
      sctx.setTransform(1, 0, 0, 1, 0, 0)
      sctx.globalCompositeOperation = "destination-in"
      sctx.drawImage(
        clip,
        minX * clipScale,
        minY * clipScale,
        bw * clipScale,
        bh * clipScale,
        0,
        0,
        bw,
        bh
      )
      sctx.globalCompositeOperation = "source-over"

      // Composite just this stamp's box onto the color layer.
      colorCtx.save()
      colorCtx.setTransform(1, 0, 0, 1, 0, 0)
      colorCtx.drawImage(scratch, 0, 0, bw, bh, minX, minY, bw, bh)
      colorCtx.restore()
    },
  }
}

// Device-pixel bounding box of CSS-space points, padded for the brush radius.
// `sx`/`sy` scale CSS to device pixels; `strokeWidth` is the CSS brush width.
export function stampBbox(
  points: { x: number; y: number }[],
  sx: number,
  sy: number,
  strokeWidth: number
): Bbox | null {
  if (points.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  const padX = (strokeWidth / 2) * sx + 2
  const padY = (strokeWidth / 2) * sy + 2
  return {
    minX: minX * sx - padX,
    minY: minY * sy - padY,
    maxX: maxX * sx + padX,
    maxY: maxY * sy + padY,
  }
}
