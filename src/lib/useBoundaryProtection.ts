import { useRef, type MutableRefObject } from "react"

import {
  EDGE_BLEED,
  beginClippedStroke,
  bleedUnderLines,
  buildClipCanvas,
  computeRegion,
  stampBbox,
  wallMaskFromCanvas,
  type ClippedStroke,
} from "./boundaryProtection"

type Point = { x: number; y: number }

type Options = {
  colorCanvasRef: MutableRefObject<HTMLCanvasElement | null>
  colorCtxRef: MutableRefObject<CanvasRenderingContext2D | null>
  lineCanvasRef: MutableRefObject<HTMLCanvasElement | null>
  // Draw the mode's stroke a→b (with whatever mirror/rotate/tile symmetry it
  // applies) onto an arbitrary context instead of the live canvas.
  stampOn: (ctx: CanvasRenderingContext2D, a: Point, b: Point) => void
  // The start point replicated to every place a stamp lands. Its regions are
  // unioned so each symmetric stamp is confined to the area it starts in.
  seedPoints: (p: Point) => Point[]
  // The current brush width in CSS pixels, used to bound each move's redraw.
  strokeWidth: () => number
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
  seedPoints,
  strokeWidth,
}: Options) {
  // The active protected stroke: it paints each move's stamps clipped to the
  // region and touches only their bounding box (see beginClippedStroke). Null
  // when not drawing a protected stroke.
  const active = useRef<ClippedStroke | null>(null)

  function begin(start: Point): boolean {
    const colorCanvas = colorCanvasRef.current
    const lineCanvas = lineCanvasRef.current
    if (!colorCanvas || !lineCanvas) return false
    const w = colorCanvas.width
    const h = colorCanvas.height
    const rect = colorCanvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return false

    const mask = wallMaskFromCanvas(lineCanvas)
    if (!mask || !mask.hasWall) return false // nothing drawn to stay inside of

    // Union the regions of every place this stroke's stamps will land.
    const sx = w / rect.width
    const sy = h / rect.height
    const union = new Uint8Array(w * h)
    let any = false
    for (const pt of seedPoints(start)) {
      const ix = Math.floor(pt.x * sx)
      const iy = Math.floor(pt.y * sy)
      if (ix < 0 || iy < 0 || ix >= w || iy >= h) continue
      const idx = iy * w + ix
      if (union[idx] || mask.data[idx]) continue // covered, or lands on a line
      const region = computeRegion(mask.data, w, h, idx)
      if (!region) continue
      for (let i = 0; i < union.length; i++) if (region[i]) union[i] = 1
      any = true
    }
    if (!any) return false // every stamp seed sits on a line

    const clipMask = bleedUnderLines(union, mask.data, w, h, EDGE_BLEED)
    const clip = buildClipCanvas(clipMask, w, h)

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

    // Every place this move's stamps land — its bounding box bounds the redraw.
    const sx = w / rect.width
    const sy = h / rect.height
    const bbox = stampBbox(
      [...seedPoints(a), ...seedPoints(b)],
      sx,
      sy,
      strokeWidth()
    )
    if (!bbox) return

    c.paint((ctx) => stampOn(ctx, a, b), bbox)
  }

  function end() {
    active.current = null
  }

  function isActive() {
    return active.current !== null
  }

  return { begin, draw, end, isActive }
}
