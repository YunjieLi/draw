import { useRef, type MutableRefObject } from "react"

import {
  EDGE_BLEED,
  bleedUnderLines,
  buildClipCanvas,
  computeRegion,
  wallMaskFromCanvas,
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
}: Options) {
  const active = useRef<{
    clip: HTMLCanvasElement // opaque inside the region(s), transparent outside
    base: HTMLCanvasElement // color layer as it was when the stroke began
    stroke: HTMLCanvasElement // the current stroke, accumulated and clipped
    strokeCtx: CanvasRenderingContext2D
  } | null>(null)

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

    const base = document.createElement("canvas")
    base.width = w
    base.height = h
    base.getContext("2d")!.drawImage(colorCanvas, 0, 0)

    const stroke = document.createElement("canvas")
    stroke.width = w
    stroke.height = h
    const strokeCtx = stroke.getContext("2d")!
    const dpr = window.devicePixelRatio || 1
    strokeCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    strokeCtx.lineCap = "round"
    strokeCtx.lineJoin = "round"

    active.current = { clip, base, stroke, strokeCtx }
    return true
  }

  function draw(a: Point, b: Point) {
    const c = active.current
    const colorCanvas = colorCanvasRef.current
    const ctx = colorCtxRef.current
    if (!c || !colorCanvas || !ctx) return
    const w = colorCanvas.width
    const h = colorCanvas.height

    // Accumulate the new segment(s) onto the stroke layer...
    stampOn(c.strokeCtx, a, b)

    // ...then clip the whole stroke to the region(s).
    c.strokeCtx.save()
    c.strokeCtx.setTransform(1, 0, 0, 1, 0, 0)
    c.strokeCtx.globalCompositeOperation = "destination-in"
    c.strokeCtx.drawImage(c.clip, 0, 0)
    c.strokeCtx.globalCompositeOperation = "source-over"
    c.strokeCtx.restore()

    // Repaint the color layer: original content, then the clipped stroke.
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(c.base, 0, 0)
    ctx.drawImage(c.stroke, 0, 0)
    ctx.restore()
  }

  function end() {
    active.current = null
  }

  function isActive() {
    return active.current !== null
  }

  return { begin, draw, end, isActive }
}
