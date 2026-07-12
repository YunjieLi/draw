import { useEffect, useRef, useState } from "react"
import { ArrowLeft, RotateCcw } from "lucide-react"

import { SaveButton } from "@/components/SaveButton"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useStrokeWidth } from "@/lib/useStrokeWidth"

type Point = { x: number; y: number }
type Layer = "line" | "color"

// The line-art layer is always drawn in black.
const LINE_COLOR = "#18181b"

// Palette for the color layer — deliberately excludes black (that's line art).
const PAINT_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
]

export default function FreeForm() {
  const containerRef = useRef<HTMLDivElement>(null)
  // Two stacked canvases: color underneath, line art on top.
  const colorCanvasRef = useRef<HTMLCanvasElement>(null)
  const lineCanvasRef = useRef<HTMLCanvasElement>(null)
  const colorCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const lineCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const drawingRef = useRef(false)
  const lastRef = useRef<Point | null>(null)
  const activePointerRef = useRef<number | null>(null)
  const colorRef = useRef(PAINT_COLORS[0])
  const layerRef = useRef<Layer>("line")
  const strokeRef = useStrokeWidth()

  const [color, setColor] = useState(PAINT_COLORS[0])
  const [layer, setLayer] = useState<Layer>("line")
  const [side, setSide] = useState(0)

  // Line art is always black; the color layer uses the picked color.
  colorRef.current = layer === "line" ? LINE_COLOR : color
  layerRef.current = layer

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
  }, [side])

  // Draw a single freehand segment on the active layer.
  function stamp(a: Point, b: Point) {
    const ctx =
      layerRef.current === "line" ? lineCtxRef.current : colorCtxRef.current
    if (!ctx) return

    ctx.strokeStyle = colorRef.current
    ctx.lineWidth = strokeRef.current
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = lineCanvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    // Single-touch only: ignore extra fingers while one is already drawing.
    if (activePointerRef.current !== null) return
    activePointerRef.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
    const p = pointFromEvent(e)
    lastRef.current = p
    stamp(p, p)
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== activePointerRef.current) return
    if (!drawingRef.current || !lastRef.current) return
    const p = pointFromEvent(e)
    stamp(lastRef.current, p)
    lastRef.current = p
  }

  function endStroke(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== activePointerRef.current) return
    drawingRef.current = false
    lastRef.current = null
    activePointerRef.current = null
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

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-muted/30">
      {/* Controls row */}
      <header className="z-10 flex shrink-0 items-center justify-between gap-3 border-b bg-background px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <a href="#/">
            <Button variant="ghost" size="icon" aria-label="Back">
              <ArrowLeft />
            </Button>
          </a>
          <span className="text-base font-semibold tracking-tight sm:text-lg">
            Free form
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Layer toggle */}
          <div className="flex items-center rounded-md bg-muted p-0.5">
            {(["line", "color"] as Layer[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLayer(l)}
                aria-pressed={layer === l}
                className={cn(
                  "rounded px-2 py-1 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
                  layer === l
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {l === "line" ? "Line" : "Color"}
              </button>
            ))}
          </div>

          {/* Color picker — only on the color layer, and never black. */}
          {layer === "color" && (
            <div className="flex items-center gap-1 sm:gap-1.5">
              {PAINT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={cn(
                    "h-5 w-5 rounded-full border transition-transform hover:scale-110 sm:h-6 sm:w-6",
                    color === c
                      ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                      : "border-black/10"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear"
            onClick={clear}
          >
            <RotateCcw />
          </Button>

          <span className="h-6 w-px bg-border" />

          <SaveButton getCanvas={composeLayers} mode="free-form" />
        </div>
      </header>

      {/* Drawing canvas */}
      <main
        ref={containerRef}
        className="flex min-h-0 flex-1 items-center justify-center p-6 sm:p-10 lg:p-12"
      >
        <div
          className="relative overflow-hidden rounded-lg border bg-white shadow-sm"
          style={{ width: side || undefined, height: side || undefined }}
        >
          {/* Color layer (bottom) — the top canvas captures pointer events and
              routes strokes to the active layer. */}
          <canvas
            ref={colorCanvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
          {/* Line-art layer (top) — always visually above the color layer. */}
          <canvas
            ref={lineCanvasRef}
            className="absolute inset-0 h-full w-full touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerLeave={endStroke}
            onPointerCancel={endStroke}
          />
        </div>
      </main>
    </div>
  )
}
