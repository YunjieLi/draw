import { useRef, type MutableRefObject } from "react"

import {
  EDGE_BLEED,
  beginClippedStroke,
  bleedUnderLines,
  buildClipCanvas,
  floodInto,
  stampBbox,
  wallMaskFromCanvas,
  type Bbox,
  type ClippedStroke,
  type WallMask,
} from "./boundaryProtection"
import type { Replica } from "./symmetry"

type Point = { x: number; y: number }

type Options = {
  colorCanvasRef: MutableRefObject<HTMLCanvasElement | null>
  colorCtxRef: MutableRefObject<CanvasRenderingContext2D | null>
  lineCanvasRef: MutableRefObject<HTMLCanvasElement | null>
  // Draw the mode's stroke a→b (with whatever mirror/rotate/tile symmetry it
  // applies) onto an arbitrary context instead of the live canvas.
  stampOn: (ctx: CanvasRenderingContext2D, a: Point, b: Point) => void
  // Every place the stroke a→b lands (the mode's Symmetry.replicas). Each
  // replica's region is flooded so it stays in the area it starts in, and each
  // replica's own box bounds the redraw.
  replicas: (a: Point, b: Point) => Replica[]
  // The current brush width in CSS pixels, used to bound each move's redraw.
  strokeWidth: () => number
  // Whether the canvas is a torus (see Symmetry.wrap): regions, and the bleed
  // under the lines, then continue across its opposite edges.
  wrap: boolean
}

// Confine freehand color strokes to the closed region(s) of the line layer they
// start in. The mode's pointer callbacks delegate to these handlers when
// protection is on and the color layer is active; `begin` returns false (so the
// caller falls back to unrestricted drawing) when the line layer has no closed
// area to stay inside of.
export function useBoundaryProtection({
  colorCanvasRef,
  colorCtxRef,
  lineCanvasRef,
  stampOn,
  replicas,
  strokeWidth,
  wrap,
}: Options) {
  // The active protected stroke: it paints each move's stamps clipped to the
  // region and touches only their bounding box (see beginClippedStroke). Null
  // when not drawing a protected stroke.
  const active = useRef<ClippedStroke | null>(null)
  // The line layer's wall mask, cached across strokes so we don't re-read every
  // pixel on each pointer-down. Invalidated (via invalidateWalls) whenever the
  // line layer is drawn on or cleared, and rebuilt if the canvas is resized.
  const wallCache = useRef<WallMask | null>(null)

  function invalidateWalls() {
    wallCache.current = null
  }

  function begin(start: Point): boolean {
    const colorCanvas = colorCanvasRef.current
    const lineCanvas = lineCanvasRef.current
    if (!colorCanvas || !lineCanvas) return false
    const w = colorCanvas.width
    const h = colorCanvas.height
    const rect = colorCanvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return false

    let mask = wallCache.current
    if (!mask || mask.w !== lineCanvas.width || mask.h !== lineCanvas.height) {
      mask = wallMaskFromCanvas(lineCanvas)
      wallCache.current = mask
    }
    if (!mask || !mask.hasWall) return false // nothing drawn to stay inside of

    // Union the regions of every place this stroke's stamps will land. A
    // replica that starts off-canvas has no pixel to flood from; on a torus its
    // region is reached anyway, from across the seam.
    const sx = w / rect.width
    const sy = h / rect.height
    const union = new Uint8Array(w * h)
    const frontier: number[] = []
    let any = false
    for (const [from] of replicas(start, start)) {
      const ix = Math.floor(from.x * sx)
      const iy = Math.floor(from.y * sy)
      if (ix < 0 || iy < 0 || ix >= w || iy >= h) continue
      const idx = iy * w + ix
      if (floodInto(union, mask.data, w, h, idx, frontier, wrap)) any = true
    }
    if (!any) return false // every stamp seed sits on a line

    // Widens `union` into the lines; it is the clip mask from here on.
    bleedUnderLines(union, mask.data, w, h, EDGE_BLEED, frontier, wrap)
    const clip = buildClipCanvas(union, w, h)

    const ctx = colorCtxRef.current
    if (!ctx) return false
    const dpr = window.devicePixelRatio || 1
    active.current = beginClippedStroke(ctx, clip, dpr)
    return true
  }

  function draw(a: Point, b: Point) {
    const c = active.current
    const colorCanvas = colorCanvasRef.current
    if (!c || !colorCanvas) return
    const w = colorCanvas.width
    const h = colorCanvas.height
    const rect = colorCanvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return

    // Bound the redraw by what this move's stamps actually cover: each replica's
    // own box, unioned. Replicas landing wholly off-canvas are dropped — a
    // wrapping mode repeats past the border, and all but the ones straddling it
    // paint nothing. Taking one box over every replica's endpoints instead would
    // span the gaps between them, which for tiles is the whole canvas.
    const sx = w / rect.width
    const sy = h / rect.height
    const sw = strokeWidth()
    let bbox: Bbox | null = null
    for (const [from, to] of replicas(a, b)) {
      const box = stampBbox([from, to], sx, sy, sw)
      if (!box) continue
      if (box.maxX <= 0 || box.minX >= w) continue
      if (box.maxY <= 0 || box.minY >= h) continue
      if (!bbox) {
        bbox = box
        continue
      }
      if (box.minX < bbox.minX) bbox.minX = box.minX
      if (box.minY < bbox.minY) bbox.minY = box.minY
      if (box.maxX > bbox.maxX) bbox.maxX = box.maxX
      if (box.maxY > bbox.maxY) bbox.maxY = box.maxY
    }
    if (!bbox) return

    c.paint((ctx) => stampOn(ctx, a, b), bbox)
  }

  function end() {
    active.current = null
  }

  function isActive() {
    return active.current !== null
  }

  return { begin, draw, end, isActive, invalidateWalls }
}
