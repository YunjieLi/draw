import { useEffect, useRef, useState } from "react"

import { useBoundaryProtection } from "./useBoundaryProtection"
import { useStrokeWidth } from "./useStrokeWidth"
import { DEFAULT_PALETTE } from "./palettes"

export type Point = { x: number; y: number }
export type Size = { w: number; h: number }
export type Layer = "line" | "color"

// The line-art layer is always drawn in black.
const LINE_COLOR = "#18181b"

// Context handed to a mode's stampOn: the live brush color and width, and the
// canvas' CSS size (which symmetry math like mandala rotation or tile wrapping
// needs). seedPoints only needs the size, passed directly.
export type StampEnv = { color: string; strokeWidth: number; size: Size }

export type DrawingCanvasOptions = {
  // Draw one segment a→b, replicated with the mode's symmetry, onto `ctx`.
  stampOn: (
    ctx: CanvasRenderingContext2D,
    a: Point,
    b: Point,
    env: StampEnv
  ) => void
  // Every place a point lands under that symmetry — its regions are unioned so
  // boundary protection confines each symmetric stamp to the area it starts in.
  seedPoints: (p: Point, size: Size) => Point[]
  // Extra work after a clear (e.g. Mandala re-randomizes its sector count).
  onClear?: () => void
}

export type DrawingCanvas = ReturnType<typeof useDrawingCanvas>

// The shared engine behind the symmetry drawing modes (free-form, mandala,
// mirror, tiles): two stacked canvases (color under a line layer), a fitted
// square viewport, single-touch pointer handling, a line/color layer toggle,
// and boundary protection. Modes supply only their symmetry (stampOn/seedPoints)
// and render the returned bindings through <DrawingCanvas>.
export function useDrawingCanvas({
  stampOn,
  seedPoints,
  onClear,
}: DrawingCanvasOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Two stacked canvases: color underneath, line art on top.
  const colorCanvasRef = useRef<HTMLCanvasElement>(null)
  const lineCanvasRef = useRef<HTMLCanvasElement>(null)
  const colorCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const lineCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const sizeRef = useRef<Size>({ w: 0, h: 0 })
  const drawingRef = useRef(false)
  const lastRef = useRef<Point | null>(null)
  const activePointerRef = useRef<number | null>(null)
  const colorRef = useRef(DEFAULT_PALETTE.colors[0])
  const layerRef = useRef<Layer>("line")
  const strokeRef = useStrokeWidth()

  const [color, setColor] = useState(DEFAULT_PALETTE.colors[0])
  const [layer, setLayer] = useState<Layer>("line")
  const [side, setSide] = useState(0)
  const [size, setSize] = useState<Size>({ w: 0, h: 0 })
  // Boundary protection keeps color strokes inside the lines; on by default.
  const [protect, setProtect] = useState(true)
  const protectRef = useRef(true)

  // Line art is always black; the color layer uses the picked color.
  colorRef.current = layer === "line" ? LINE_COLOR : color
  layerRef.current = layer
  protectRef.current = protect

  // Fit the square canvas to the largest square inside its container.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const compute = () => {
      const style = getComputedStyle(el)
      const padX =
        parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      const padY =
        parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      const w = el.clientWidth - padX
      const h = el.clientHeight - padY
      setSide(Math.max(0, Math.floor(Math.min(w, h))))
    }
    compute()
    const observer = new ResizeObserver(compute)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // (Re)size both backing canvases whenever the square side changes, preserving art.
  useEffect(() => {
    const line = lineCanvasRef.current
    const color = colorCanvasRef.current
    if (!line || !color || side === 0) return
    const rect = line.getBoundingClientRect()
    if (rect.width === 0) return
    const dpr = window.devicePixelRatio || 1

    const resize = (
      canvas: HTMLCanvasElement,
      ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>
    ) => {
      let snapshot: HTMLCanvasElement | null = null
      if (canvas.width > 0 && canvas.height > 0) {
        snapshot = document.createElement("canvas")
        snapshot.width = canvas.width
        snapshot.height = canvas.height
        snapshot.getContext("2d")?.drawImage(canvas, 0, 0)
      }

      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      const ctx = canvas.getContext("2d")!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctxRef.current = ctx

      if (snapshot) {
        ctx.drawImage(snapshot, 0, 0, rect.width, rect.height)
      }
    }

    resize(color, colorCtxRef)
    resize(line, lineCtxRef)
    sizeRef.current = { w: rect.width, h: rect.height }
    setSize({ w: rect.width, h: rect.height })
  }, [side])

  // Bind the mode's symmetry to the live brush state so boundary protection and
  // the plain brush can call it with just (ctx, a, b) / (p).
  const boundStampOn = (
    ctx: CanvasRenderingContext2D,
    a: Point,
    b: Point
  ) =>
    stampOn(ctx, a, b, {
      color: colorRef.current,
      strokeWidth: strokeRef.current,
      size: sizeRef.current,
    })
  const boundSeedPoints = (p: Point) => seedPoints(p, sizeRef.current)

  // Draw on the active layer's live canvas.
  function stamp(a: Point, b: Point) {
    const ctx =
      layerRef.current === "line" ? lineCtxRef.current : colorCtxRef.current
    if (ctx) boundStampOn(ctx, a, b)
  }

  // Confines color strokes to the closed region of the line layer they start in.
  const protection = useBoundaryProtection({
    colorCanvasRef,
    colorCtxRef,
    lineCanvasRef,
    stampOn: boundStampOn,
    seedPoints: boundSeedPoints,
    strokeWidth: () => strokeRef.current,
  })

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = lineCanvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    // Single-touch only: ignore extra fingers while one is already drawing.
    if (activePointerRef.current !== null) return
    const p = pointFromEvent(e)
    // In the color layer, confine to the region under the pointer when enabled
    // and the line layer actually encloses one.
    const confined =
      layerRef.current === "color" && protectRef.current && protection.begin(p)
    activePointerRef.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
    lastRef.current = p
    if (confined) protection.draw(p, p)
    else stamp(p, p)
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== activePointerRef.current) return
    if (!drawingRef.current || !lastRef.current) return
    const p = pointFromEvent(e)
    if (protection.isActive()) protection.draw(lastRef.current, p)
    else stamp(lastRef.current, p)
    lastRef.current = p
  }

  function endStroke(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== activePointerRef.current) return
    drawingRef.current = false
    lastRef.current = null
    activePointerRef.current = null
    protection.end()
    // A finished line-layer stroke changed the walls; drop the cached mask.
    if (layerRef.current === "line") protection.invalidateWalls()
  }

  function clear() {
    for (const canvas of [lineCanvasRef.current, colorCanvasRef.current]) {
      const ctx = canvas?.getContext("2d")
      if (!ctx || !canvas) continue
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
    }
    protection.invalidateWalls()
    onClear?.()
  }

  // Flatten both layers (color beneath, line art on top) for saving.
  function composeLayers(): HTMLCanvasElement | null {
    const line = lineCanvasRef.current
    const color = colorCanvasRef.current
    if (!line || !color) return null
    const out = document.createElement("canvas")
    out.width = line.width
    out.height = line.height
    const ctx = out.getContext("2d")!
    ctx.drawImage(color, 0, 0)
    ctx.drawImage(line, 0, 0)
    return out
  }

  return {
    containerRef,
    colorCanvasRef,
    lineCanvasRef,
    color,
    setColor,
    layer,
    setLayer,
    protect,
    setProtect,
    side,
    size,
    onPointerDown,
    onPointerMove,
    endStroke,
    clear,
    composeLayers,
    getLineCanvas: () => lineCanvasRef.current,
  }
}
