// Shared "boundary protection" primitives: keep a paint stroke inside the
// closed region of a line layer it starts in. Used by the line-art coloring
// page and, via useBoundaryProtection, by the freehand modes.

// A line pixel counts as a "wall" (a boundary a protected stroke can't cross)
// once its rendered alpha clears this threshold — low enough that antialiased
// edges stay continuous across even thin lines.
export const WALL_ALPHA = 60

// A protected stroke bleeds this many device pixels *under* the line edges,
// expanding only across wall pixels, so no white slivers are left uncoloured
// along the lines. Kept small so it can't bridge a thin line.
export const EDGE_BLEED = 3

export type WallMask = {
  w: number
  h: number
  data: Uint8Array // 1 = wall (line), 0 = paintable
  hasWall: boolean
}

// Build a wall mask from a canvas' own pixels (e.g. a user-drawn line layer).
export function wallMaskFromCanvas(canvas: HTMLCanvasElement): WallMask | null {
  const w = canvas.width
  const h = canvas.height
  if (w === 0 || h === 0) return null
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  const px = ctx.getImageData(0, 0, w, h).data
  const data = new Uint8Array(w * h)
  let hasWall = false
  for (let i = 0; i < data.length; i++)
    if (px[i * 4 + 3] >= WALL_ALPHA) {
      data[i] = 1
      hasWall = true
    }
  return { w, h, data, hasWall }
}

// Build a wall mask from already-rasterized pixels (e.g. a decoded line-art
// image drawn onto an offscreen canvas).
export function wallMaskFromPixels(
  px: Uint8ClampedArray,
  w: number,
  h: number
): Uint8Array {
  const data = new Uint8Array(w * h)
  for (let i = 0; i < data.length; i++)
    if (px[i * 4 + 3] >= WALL_ALPHA) data[i] = 1
  return data
}

// Flood the closed region containing `start` (a device-pixel index), bounded by
// walls. Returns a per-pixel mask (1 = in region), or null if `start` is a wall.
export function computeRegion(
  wall: Uint8Array,
  w: number,
  h: number,
  start: number
): Uint8Array | null {
  if (wall[start]) return null
  const region = new Uint8Array(w * h)
  const stack = [start]
  region[start] = 1
  while (stack.length) {
    const i = stack.pop()!
    const x = i % w
    const left = i - 1
    const right = i + 1
    const up = i - w
    const down = i + w
    if (x > 0 && !region[left] && !wall[left]) (region[left] = 1), stack.push(left)
    if (x < w - 1 && !region[right] && !wall[right])
      (region[right] = 1), stack.push(right)
    if (up >= 0 && !region[up] && !wall[up]) (region[up] = 1), stack.push(up)
    if (down < w * h && !region[down] && !wall[down])
      (region[down] = 1), stack.push(down)
  }
  return region
}

// Grow `region` outward by `bleed` pixels, but only across wall pixels — so
// paint slides under the antialiased line edge yet can never reach the fillable
// interior of an adjacent region. Returns the expanded mask.
export function bleedUnderLines(
  region: Uint8Array,
  wall: Uint8Array,
  w: number,
  h: number,
  bleed: number
): Uint8Array {
  const n = w * h
  const out = region.slice()
  let frontier: number[] = []
  for (let i = 0; i < n; i++) {
    if (!region[i]) continue
    const x = i % w
    if (
      (x > 0 && wall[i - 1]) ||
      (x < w - 1 && wall[i + 1]) ||
      (i - w >= 0 && wall[i - w]) ||
      (i + w < n && wall[i + w])
    )
      frontier.push(i)
  }
  for (let step = 0; step < bleed && frontier.length; step++) {
    const next: number[] = []
    for (const i of frontier) {
      const x = i % w
      const left = i - 1
      const right = i + 1
      const up = i - w
      const down = i + w
      if (x > 0 && !out[left] && wall[left]) (out[left] = 1), next.push(left)
      if (x < w - 1 && !out[right] && wall[right])
        (out[right] = 1), next.push(right)
      if (up >= 0 && !out[up] && wall[up]) (out[up] = 1), next.push(up)
      if (down < n && !out[down] && wall[down]) (out[down] = 1), next.push(down)
    }
    frontier = next
  }
  return out
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
  const d = img.data
  for (let i = 0; i < mask.length; i++)
    if (mask[i]) {
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = d[i * 4 + 3] = 255
    }
  clip.getContext("2d")!.putImageData(img, 0, 0)
  return clip
}
