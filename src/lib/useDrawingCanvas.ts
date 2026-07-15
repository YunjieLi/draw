import { useEffect, useRef, useState } from "react"

import { useBoundaryProtection } from "./useBoundaryProtection"
import { DEFAULT_PALETTE } from "./palettes"
import type { DrawingMode } from "./drawings"
import { consumeTemplateFor, subscribeTemplate } from "./templateStore"
import { decodeTemplateImage } from "./templateImage"
import {
  defaultParams,
  getSymmetry,
  type Point,
  type Size,
  type SymParams,
} from "./symmetry"

// The color brush is a fixed, chunky width — good for filling regions.
const COLOR_STROKE_WIDTH = 8

export type DrawingCanvas = ReturnType<typeof useDrawingCanvas>

// The shared engine behind the four coloring modes (free-form, mandala, mirror,
// tiles). These are colour-only surfaces: a single paint canvas over an optional
// read-only template (the line layer), coloured with the mode's symmetry and
// boundary protection. Line-drawing lives in the template creator, not here.
export function useDrawingCanvas({ mode }: { mode: DrawingMode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Two stacked canvases: colour underneath, the (read-only) template on top.
  const colorCanvasRef = useRef<HTMLCanvasElement>(null)
  const lineCanvasRef = useRef<HTMLCanvasElement>(null)
  const colorCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const lineCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const sizeRef = useRef<Size>({ w: 0, h: 0 })
  const drawingRef = useRef(false)
  const lastRef = useRef<Point | null>(null)
  const activePointerRef = useRef<number | null>(null)
  const colorRef = useRef(DEFAULT_PALETTE.colors[0])
  const strokeRef = useRef<number>(COLOR_STROKE_WIDTH)
  // A loaded template's decoded image. When set, the line layer shows it and it
  // provides the boundaries the colour strokes stay inside.
  const templateImgRef = useRef<HTMLImageElement | null>(null)

  const [color, setColor] = useState(DEFAULT_PALETTE.colors[0])
  const [side, setSide] = useState(0)
  const [size, setSize] = useState<Size>({ w: 0, h: 0 })
  // Boundary protection keeps colour strokes inside the lines; on by default.
  const [protect, setProtect] = useState(true)
  const protectRef = useRef(true)
  // Symmetry settings — a loaded template's, otherwise the mode default.
  const [params, setParams] = useState<SymParams>(defaultParams)
  const [templateLoaded, setTemplateLoaded] = useState(false)

  colorRef.current = color
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

  // Paint the loaded template onto the line canvas, contain-fit so its aspect
  // ratio is preserved inside the (square/round) canvas. Rebuilt on resize.
  function drawTemplate() {
    const img = templateImgRef.current
    const line = lineCanvasRef.current
    const ctx = lineCtxRef.current
    const { w, h } = sizeRef.current
    if (!img || !line || !ctx || w === 0) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, line.width, line.height)
    ctx.restore()
    const ar = img.naturalWidth / img.naturalHeight || 1
    let dw = w
    let dh = w / ar
    if (dh > h) {
      dh = h
      dw = h * ar
    }
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
    protection.invalidateWalls()
  }

  // Decode a template image and adopt its symmetry settings. The
  // [templateLoaded, size] effect paints it once the canvas is ready.
  function loadTemplate(src: string, templateParams: SymParams) {
    decodeTemplateImage(src)
      .then((img) => {
        templateImgRef.current = img
        setParams(templateParams)
        setTemplateLoaded(true)
      })
      .catch(() => {})
  }

  // (Re)paint the template whenever it loads or the canvas resizes.
  useEffect(() => {
    if (templateLoaded) drawTemplate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateLoaded, size])

  // Claim a template published for this mode — on mount (we navigated in with
  // one pending) or via the store while already mounted.
  useEffect(() => {
    const tryConsume = () => {
      const t = consumeTemplateFor(mode)
      if (t) loadTemplate(t.src, t.params)
    }
    tryConsume()
    return subscribeTemplate(tryConsume)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // The mode's symmetry, bound to the live brush state so protection and the
  // plain brush can call it with just (ctx, a, b) / (p).
  const symmetry = getSymmetry(mode, params)
  const boundStampOn = (ctx: CanvasRenderingContext2D, a: Point, b: Point) =>
    symmetry.stampOn(ctx, a, b, {
      color: colorRef.current,
      strokeWidth: strokeRef.current,
      size: sizeRef.current,
    })
  const boundSeedPoints = (p: Point) => symmetry.seedPoints(p, sizeRef.current)

  function stamp(a: Point, b: Point) {
    const ctx = colorCtxRef.current
    if (ctx) boundStampOn(ctx, a, b)
  }

  // Confines colour strokes to the closed region of the template they start in.
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
    // Confine to the region under the pointer when protection is on and the
    // template actually encloses one.
    const confined = protectRef.current && protection.begin(p)
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
  }

  function clear() {
    // Clear the colouring only; a loaded template (the line layer) stays put.
    const ctx = colorCtxRef.current
    const canvas = colorCanvasRef.current
    if (ctx && canvas) {
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
    }
    // With no template, also clear any free-drawn line canvas remnants.
    if (!templateImgRef.current) {
      const lctx = lineCtxRef.current
      const lc = lineCanvasRef.current
      if (lctx && lc) {
        lctx.save()
        lctx.setTransform(1, 0, 0, 1, 0, 0)
        lctx.clearRect(0, 0, lc.width, lc.height)
        lctx.restore()
      }
      protection.invalidateWalls()
    }
  }

  // Flatten both layers (colour beneath, template on top) for saving.
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
    mode,
    params,
    containerRef,
    colorCanvasRef,
    lineCanvasRef,
    color,
    setColor,
    protect,
    setProtect,
    side,
    size,
    templateLoaded,
    onPointerDown,
    onPointerMove,
    endStroke,
    clear,
    composeLayers,
  }
}
