import { useEffect, useRef, useState } from "react"
import { LayoutGrid, RotateCcw } from "lucide-react"

import { ColorPalette } from "@/components/ColorPalette"
import { ModeSwitcher } from "@/components/ModeSwitcher"
import { ProtectionMenu } from "@/components/ProtectionMenu"
import { SaveButton } from "@/components/SaveButton"
import { SaveLineArtMenu } from "@/components/SaveLineArtMenu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DEFAULT_PALETTE } from "@/lib/palettes"
import { useBoundaryProtection } from "@/lib/useBoundaryProtection"
import { useStrokeWidth } from "@/lib/useStrokeWidth"

type Point = { x: number; y: number }
type Layer = "line" | "color"

// The line-art layer is always drawn in black.
const LINE_COLOR = "#18181b"

// Fixed drawing parameters.
const MIRROR = false

const SECTOR_CHOICES = [5, 6, 8]
const randomSectors = () =>
  SECTOR_CHOICES[Math.floor(Math.random() * SECTOR_CHOICES.length)]

export default function Mandala() {
  const containerRef = useRef<HTMLDivElement>(null)
  // Two stacked canvases: color underneath, line art on top.
  const colorCanvasRef = useRef<HTMLCanvasElement>(null)
  const lineCanvasRef = useRef<HTMLCanvasElement>(null)
  const colorCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const lineCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const sizeRef = useRef({ w: 0, h: 0 })
  const drawingRef = useRef(false)
  const lastRef = useRef<Point | null>(null)
  const activePointerRef = useRef<number | null>(null)
  const colorRef = useRef(DEFAULT_PALETTE.colors[0])
  const layerRef = useRef<Layer>("line")
  const sectorsRef = useRef(SECTOR_CHOICES[0])
  const strokeRef = useStrokeWidth()

  const [color, setColor] = useState(DEFAULT_PALETTE.colors[0])
  const [layer, setLayer] = useState<Layer>("line")
  const [side, setSide] = useState(0)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [sectors, setSectors] = useState(randomSectors)
  // Boundary protection keeps color strokes inside the lines; on by default.
  const [protect, setProtect] = useState(true)
  const protectRef = useRef(true)

  // Line art is always black; the color layer uses the picked color.
  colorRef.current = layer === "line" ? LINE_COLOR : color
  layerRef.current = layer
  sectorsRef.current = sectors
  protectRef.current = protect

  // Fit the circular canvas to the largest square inside its container.
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

  // Draw one segment onto a given context, replicated with dihedral symmetry.
  function stampOn(ctx: CanvasRenderingContext2D, a: Point, b: Point) {
    const { w, h } = sizeRef.current
    const cx = w / 2
    const cy = h / 2

    ctx.strokeStyle = colorRef.current
    ctx.lineWidth = strokeRef.current

    const sectors = sectorsRef.current
    const step = (Math.PI * 2) / sectors
    for (let i = 0; i < sectors; i++) {
      const angle = step * i

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(angle)
      ctx.beginPath()
      ctx.moveTo(a.x - cx, a.y - cy)
      ctx.lineTo(b.x - cx, b.y - cy)
      ctx.stroke()
      ctx.restore()

      if (MIRROR) {
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(angle)
        ctx.scale(-1, 1)
        ctx.beginPath()
        ctx.moveTo(a.x - cx, a.y - cy)
        ctx.lineTo(b.x - cx, b.y - cy)
        ctx.stroke()
        ctx.restore()
      }
    }
  }

  // Draw on the active layer's live canvas.
  function stamp(a: Point, b: Point) {
    const ctx =
      layerRef.current === "line" ? lineCtxRef.current : colorCtxRef.current
    if (ctx) stampOn(ctx, a, b)
  }

  // A stroke lands rotated into each sector (matching stampOn's rotations).
  const seedPoints = (p: Point) => {
    const { w, h } = sizeRef.current
    const cx = w / 2
    const cy = h / 2
    const rx = p.x - cx
    const ry = p.y - cy
    const sectors = sectorsRef.current
    const step = (Math.PI * 2) / sectors
    const pts: Point[] = []
    for (let i = 0; i < sectors; i++) {
      const c = Math.cos(step * i)
      const s = Math.sin(step * i)
      pts.push({ x: cx + rx * c - ry * s, y: cy + rx * s + ry * c })
    }
    return pts
  }

  // Confines color strokes to the closed region of the line layer they start in.
  const protection = useBoundaryProtection({
    colorCanvasRef,
    colorCtxRef,
    lineCanvasRef,
    stampOn,
    seedPoints,
  })

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = lineCanvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    // Single-touch only: ignore extra fingers while one is already drawing.
    if (activePointerRef.current !== null) return
    const p = pointFromEvent(e)
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
    setSectors(randomSectors())
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

  // Guide spokes marking each sector boundary.
  const guides: Array<{ x2: number; y2: number }> = []
  if (size.w > 0) {
    const cx = size.w / 2
    const cy = size.h / 2
    const r = size.w / 2
    for (let i = 0; i < sectors; i++) {
      const angle = -Math.PI / 2 + (Math.PI * 2 * i) / sectors
      guides.push({ x2: cx + r * Math.cos(angle), y2: cy + r * Math.sin(angle) })
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-muted/30">
      {/* Controls row */}
      <header className="z-10 flex shrink-0 items-center justify-between gap-3 border-b bg-background px-3 py-2 sm:px-4 sm:py-3">
        <ModeSwitcher current="mandala" />

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
                  "rounded px-2 py-1 text-xs font-medium capitalize transition-colors sm:px-3 sm:text-sm",
                  layer === l
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {l === "line" ? "Line" : "Color"}
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear"
            onClick={clear}
          >
            <RotateCcw />
          </Button>

          <span className="h-6 w-px bg-border" />

          <SaveButton getCanvas={composeLayers} mode="mandala" />

          <SaveLineArtMenu
            mode="mandala"
            getLineCanvas={() => lineCanvasRef.current}
          />

          <a href="#/gallery">
            <Button variant="outline">
              <LayoutGrid />
              Library
            </Button>
          </a>
        </div>
      </header>

      {/* Drawing area — palette sits beside the canvas (bottom on portrait,
          left on landscape), never overlapping it. */}
      <div className="flex min-h-0 flex-1 flex-col landscape:flex-row">
        <main
          ref={containerRef}
          className="flex min-h-0 flex-1 items-center justify-center p-4"
        >
          <div
            className="relative overflow-hidden rounded-full border bg-white shadow-sm"
            style={{ width: side || undefined, height: side || undefined }}
          >
            {/* Color layer (bottom) — receives no pointer events; the top canvas
                captures them and routes strokes to the active layer. */}
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
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              width={size.w}
              height={size.h}
            >
              {guides.map((g, i) => (
                <line
                  key={i}
                  x1={size.w / 2}
                  y1={size.h / 2}
                  x2={g.x2}
                  y2={g.y2}
                  className="stroke-zinc-900/[0.06]"
                  strokeWidth={1}
                />
              ))}
            </svg>
          </div>
        </main>

        {layer === "color" && (
          <ColorPalette
            value={color}
            onChange={setColor}
            footer={<ProtectionMenu protect={protect} onChange={setProtect} />}
          />
        )}
      </div>
    </div>
  )
}
