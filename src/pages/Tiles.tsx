import { useEffect, useRef, useState } from "react"
import { ArrowLeft, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useStrokeWidth } from "@/lib/useStrokeWidth"

type Point = { x: number; y: number }

const COLORS = [
  "#18181b",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
]

// Fixed drawing parameters.
const GRID = 4

export default function Tiles() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const sizeRef = useRef({ w: 0, h: 0 })
  const drawingRef = useRef(false)
  const lastRef = useRef<Point | null>(null)
  const activePointerRef = useRef<number | null>(null)
  const colorRef = useRef(COLORS[0])
  const strokeRef = useStrokeWidth()

  const [color, setColor] = useState(COLORS[0])
  const [side, setSide] = useState(0)
  const [size, setSize] = useState({ w: 0, h: 0 })

  colorRef.current = color

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

  // (Re)size the backing canvas whenever the square side changes, preserving art.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || side === 0) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0) return
    const dpr = window.devicePixelRatio || 1

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
    sizeRef.current = { w: rect.width, h: rect.height }
    setSize({ w: rect.width, h: rect.height })
  }, [side])

  // Draw one segment, replicated into every tile of the grid. The stroke
  // wraps toroidally so the pattern stays seamless across tile edges.
  function stamp(a: Point, b: Point) {
    const ctx = ctxRef.current
    if (!ctx) return
    const { w, h } = sizeRef.current
    const cw = w / GRID
    const ch = h / GRID

    ctx.strokeStyle = colorRef.current
    ctx.lineWidth = strokeRef.current

    // Local coordinates within a single tile, taken from the base point.
    const baseCol = Math.floor(a.x / cw)
    const baseRow = Math.floor(a.y / ch)

    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const dx = (col - baseCol) * cw
        const dy = (row - baseRow) * ch
        ctx.beginPath()
        ctx.moveTo(a.x + dx, a.y + dy)
        ctx.lineTo(b.x + dx, b.y + dy)
        ctx.stroke()
      }
    }
  }

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = canvasRef.current!.getBoundingClientRect()
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
    const ctx = ctxRef.current
    const canvas = canvasRef.current
    if (!ctx || !canvas) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
  }

  // Guide lines marking each tile boundary.
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
  if (size.w > 0) {
    const cw = size.w / GRID
    const ch = size.h / GRID
    for (let i = 1; i < GRID; i++) {
      lines.push({ x1: i * cw, y1: 0, x2: i * cw, y2: size.h })
      lines.push({ x1: 0, y1: i * ch, x2: size.w, y2: i * ch })
    }
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
            Tiles
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 sm:gap-1.5">
            {COLORS.map((c) => (
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

          <span className="h-6 w-px bg-border" />

          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear"
            onClick={clear}
          >
            <RotateCcw />
          </Button>
        </div>
      </header>

      {/* Tiled canvas */}
      <main
        ref={containerRef}
        className="flex min-h-0 flex-1 items-center justify-center p-6 sm:p-10 lg:p-12"
      >
        <div
          className="relative overflow-hidden rounded-lg border bg-white shadow-sm"
          style={{ width: side || undefined, height: side || undefined }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerLeave={endStroke}
            onPointerCancel={endStroke}
          />
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            width={size.w}
            height={size.h}
          >
            {lines.map((l, i) => (
              <line
                key={i}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                className="stroke-zinc-900/[0.06]"
                strokeWidth={1}
              />
            ))}
          </svg>
        </div>
      </main>
    </div>
  )
}
