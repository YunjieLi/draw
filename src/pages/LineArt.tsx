import { useEffect, useRef, useState } from "react"
import { Brush, FilePlus, LayoutGrid, PaintBucket, RotateCcw, X } from "lucide-react"

import { ColorPalette } from "@/components/ColorPalette"
import { ModeSwitcher } from "@/components/ModeSwitcher"
import { SaveButton } from "@/components/SaveButton"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DEFAULT_PALETTE } from "@/lib/palettes"
import { LINEARTS, type LineArt as LineArtDef } from "@/lib/linearts"
import { useStrokeWidth } from "@/lib/useStrokeWidth"

type Point = { x: number; y: number }
type Tool = "brush" | "bucket"

// A pixel of the line-art layer counts as a "wall" (a boundary the bucket fill
// cannot cross) when its rendered alpha clears this threshold. The lines are
// drawn well above it; antialiased fringes fall below, so the fill stops just
// shy of a line — harmless since the opaque line overlay hides that seam.
const WALL_ALPHA = 100

// #rrggbb / #rgb -> [r, g, b]. Palette colors are always hex.
function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "")
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Line-art mode: pick a read-only line drawing from the library, then color it
// in. Unlike the freehand modes there is no line/color toggle — the chosen art
// is the (fixed) line layer and the user only ever paints on the color layer.
//
// The library is a modal over the coloring view: opening it never discards the
// drawing in progress, so dismissing it without picking resumes that drawing.
export default function LineArt() {
  const [selected, setSelected] = useState<LineArtDef | null>(LINEARTS[0] ?? null)
  // Open the library on entry so the first thing the user does is pick a picture.
  const [libraryOpen, setLibraryOpen] = useState(true)

  return (
    <>
      {selected && (
        // Keyed by art id so picking a different picture starts a fresh canvas,
        // while merely opening/closing the modal leaves this instance mounted.
        <LineArtColoring
          key={selected.id}
          art={selected}
          onOpenLibrary={() => setLibraryOpen(true)}
        />
      )}
      {libraryOpen && (
        <LibraryModal
          onPick={(art) => {
            setSelected(art)
            setLibraryOpen(false)
          }}
          onClose={() => setLibraryOpen(false)}
        />
      )}
    </>
  )
}

// Modal gallery of the bundled line arts. Picking one loads it into the coloring
// view; closing it (backdrop, Escape, or the close button) resumes the drawing.
function LibraryModal({
  onPick,
  onClose,
}: {
  onPick: (art: LineArtDef) => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Click-away backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Line art library"
        className="relative flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border bg-background shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold tracking-tight sm:text-lg">
            Pick a picture to color in
          </h2>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {LINEARTS.map((art) => (
              <button
                key={art.id}
                type="button"
                onClick={() => onPick(art)}
                className="group overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
              >
                <div className="aspect-[3/4] w-full">
                  <img
                    src={art.src}
                    alt={art.label}
                    loading="lazy"
                    draggable={false}
                    className="h-full w-full object-contain p-3 transition-transform group-hover:scale-[1.03]"
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Segmented brush/bucket switch shown at the leading edge of the palette bar.
// Brush paints freehand strokes; bucket flood-fills the tapped enclosed region.
function ToolToggle({
  tool,
  onChange,
}: {
  tool: Tool
  onChange: (tool: Tool) => void
}) {
  const options: { value: Tool; label: string; Icon: typeof Brush }[] = [
    { value: "brush", label: "Brush", Icon: Brush },
    { value: "bucket", label: "Fill", Icon: PaintBucket },
  ]
  return (
    <div
      role="radiogroup"
      aria-label="Tool"
      className="flex gap-1 rounded-lg border bg-background p-1 shadow-sm landscape:flex-col"
    >
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={tool === value}
          aria-label={label}
          title={label}
          onClick={() => onChange(value)}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
            tool === value
              ? "bg-foreground text-background"
              : "text-foreground hover:bg-muted"
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  )
}

// Coloring surface: the line art sits as a fixed overlay above a single color
// canvas that captures all pointer input.
function LineArtColoring({
  art,
  onOpenLibrary,
}: {
  art: LineArtDef
  onOpenLibrary: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const colorCanvasRef = useRef<HTMLCanvasElement>(null)
  const colorCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  // The line art decoded as an image, kept for compositing at save time.
  const lineImgRef = useRef<HTMLImageElement | null>(null)
  const drawingRef = useRef(false)
  const lastRef = useRef<Point | null>(null)
  const activePointerRef = useRef<number | null>(null)
  const colorRef = useRef(DEFAULT_PALETTE.colors[0])
  const strokeRef = useStrokeWidth()
  // Bucket-fill boundary mask: 1 = line-art wall, 0 = fillable, sized to match
  // the backing canvas' device pixels. Rebuilt lazily and invalidated whenever
  // the canvas is resized or the art changes.
  const wallMaskRef = useRef<{ w: number; h: number; data: Uint8Array } | null>(
    null
  )

  const [color, setColor] = useState(DEFAULT_PALETTE.colors[0])
  const [tool, setTool] = useState<Tool>("brush")
  const toolRef = useRef<Tool>("brush")
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  // Portrait default until the decoded image gives us the real aspect ratio.
  const [aspect, setAspect] = useState(3 / 4)

  colorRef.current = color
  toolRef.current = tool

  // Decode the line art once: it drives the fitted aspect ratio and is composited
  // over the color layer at save time.
  useEffect(() => {
    lineImgRef.current = null
    wallMaskRef.current = null
    const img = new Image()
    img.onload = () => {
      lineImgRef.current = img
      wallMaskRef.current = null
      if (img.naturalWidth > 0 && img.naturalHeight > 0)
        setAspect(img.naturalWidth / img.naturalHeight)
    }
    img.src = art.src
  }, [art.src])

  // Fit the canvas to the largest rectangle with the art's aspect ratio that
  // fits inside the drawing area.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const compute = () => {
      const style = getComputedStyle(el)
      const padX =
        parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      const padY =
        parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      const cw = el.clientWidth - padX
      const ch = el.clientHeight - padY
      if (cw <= 0 || ch <= 0) return
      let w = cw
      let h = w / aspect
      if (h > ch) {
        h = ch
        w = h * aspect
      }
      setSize({ w: Math.floor(w), h: Math.floor(h) })
    }
    compute()
    const observer = new ResizeObserver(compute)
    observer.observe(el)
    return () => observer.disconnect()
  }, [aspect])

  // (Re)size the backing canvas whenever the fitted size changes, preserving
  // whatever the user has already painted.
  useEffect(() => {
    const canvas = colorCanvasRef.current
    if (!canvas || size.w === 0) return
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
    colorCtxRef.current = ctx
    // Resolution changed: the wall mask no longer matches the canvas.
    wallMaskRef.current = null

    if (snapshot) ctx.drawImage(snapshot, 0, 0, rect.width, rect.height)
  }, [size])

  function stamp(a: Point, b: Point) {
    const ctx = colorCtxRef.current
    if (!ctx) return
    ctx.strokeStyle = colorRef.current
    ctx.lineWidth = strokeRef.current
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = colorCanvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  // Rasterize the line art at the canvas' device resolution and mark every
  // wall pixel. Built once per size/art and cached for subsequent fills.
  function getWallMask() {
    const canvas = colorCanvasRef.current
    const img = lineImgRef.current
    if (!canvas || !img) return null
    const w = canvas.width
    const h = canvas.height
    const cached = wallMaskRef.current
    if (cached && cached.w === w && cached.h === h) return cached

    const off = document.createElement("canvas")
    off.width = w
    off.height = h
    const octx = off.getContext("2d", { willReadFrequently: true })!
    octx.drawImage(img, 0, 0, w, h)
    const px = octx.getImageData(0, 0, w, h).data
    const data = new Uint8Array(w * h)
    for (let i = 0; i < data.length; i++)
      if (px[i * 4 + 3] >= WALL_ALPHA) data[i] = 1

    const mask = { w, h, data }
    wallMaskRef.current = mask
    return mask
  }

  // Flood-fill the closed region of the color layer containing (cssX, cssY),
  // stopping at line-art walls. Coordinates are in CSS pixels relative to the
  // canvas; they're mapped to device pixels for the fill.
  function bucketFill(cssX: number, cssY: number) {
    const canvas = colorCanvasRef.current
    const ctx = colorCtxRef.current
    const mask = getWallMask()
    if (!canvas || !ctx || !mask) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return

    const w = canvas.width
    const h = canvas.height
    const sx = Math.floor((cssX / rect.width) * w)
    const sy = Math.floor((cssY / rect.height) * h)
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return
    const start = sy * w + sx
    if (mask.data[start]) return // tapped on a line — nothing to fill

    const [r, g, b] = hexToRgb(colorRef.current)
    // getImageData/putImageData operate in device pixels, ignoring the DPR
    // transform set on the context, so no coordinate scaling is needed here.
    const image = ctx.getImageData(0, 0, w, h)
    const d = image.data
    const seen = new Uint8Array(w * h)
    const stack = [start]
    seen[start] = 1
    while (stack.length) {
      const i = stack.pop()!
      const p = i * 4
      d[p] = r
      d[p + 1] = g
      d[p + 2] = b
      d[p + 3] = 255
      const x = i % w
      const left = i - 1
      const right = i + 1
      const up = i - w
      const down = i + w
      if (x > 0 && !seen[left] && !mask.data[left]) (seen[left] = 1), stack.push(left)
      if (x < w - 1 && !seen[right] && !mask.data[right])
        (seen[right] = 1), stack.push(right)
      if (up >= 0 && !seen[up] && !mask.data[up]) (seen[up] = 1), stack.push(up)
      if (down < w * h && !seen[down] && !mask.data[down])
        (seen[down] = 1), stack.push(down)
    }
    ctx.putImageData(image, 0, 0)
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointerRef.current !== null) return
    const p = pointFromEvent(e)
    if (toolRef.current === "bucket") {
      bucketFill(p.x, p.y)
      return
    }
    activePointerRef.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
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
    const canvas = colorCanvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx || !canvas) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
  }

  // Flatten the color layer with the line art on top for saving.
  function composeLayers(): HTMLCanvasElement | null {
    const color = colorCanvasRef.current
    if (!color) return null
    const out = document.createElement("canvas")
    out.width = color.width
    out.height = color.height
    const ctx = out.getContext("2d")!
    ctx.drawImage(color, 0, 0)
    if (lineImgRef.current)
      ctx.drawImage(lineImgRef.current, 0, 0, out.width, out.height)
    return out
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-muted/30">
      <header className="z-10 flex shrink-0 items-center justify-between gap-3 border-b bg-background px-3 py-2 sm:px-4 sm:py-3">
        <ModeSwitcher current="line-art" />

        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Choose another line art"
            onClick={onOpenLibrary}
          >
            <FilePlus />
          </Button>

          <Button variant="ghost" size="icon" aria-label="Clear" onClick={clear}>
            <RotateCcw />
          </Button>

          <span className="h-6 w-px bg-border" />

          <SaveButton getCanvas={composeLayers} mode="line-art" />

          <a href="#/gallery">
            <Button variant="outline">
              <LayoutGrid />
              Library
            </Button>
          </a>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col landscape:flex-row">
        <main
          ref={containerRef}
          className="flex min-h-0 flex-1 items-center justify-center p-4"
        >
          <div
            className="relative overflow-hidden rounded-lg border bg-white shadow-sm"
            style={{ width: size.w || undefined, height: size.h || undefined }}
          >
            {/* Color layer (bottom) — captures all pointer input. */}
            <canvas
              ref={colorCanvasRef}
              className="absolute inset-0 h-full w-full touch-none"
              style={{ cursor: tool === "bucket" ? "cell" : "crosshair" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endStroke}
              onPointerLeave={endStroke}
              onPointerCancel={endStroke}
            />
            {/* Read-only line layer (top) — sits above the color, ignores input
                so strokes fall through to the canvas beneath. */}
            <img
              src={art.src}
              alt={art.label}
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full select-none"
            />
          </div>
        </main>

        <ColorPalette
          value={color}
          onChange={setColor}
          leading={<ToolToggle tool={tool} onChange={setTool} />}
        />
      </div>
    </div>
  )
}
