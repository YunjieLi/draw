import { useEffect, useRef, useState } from "react"
import { FilePlus, LayoutGrid, RotateCcw, X } from "lucide-react"

import { ColorPalette } from "@/components/ColorPalette"
import { ModeSwitcher } from "@/components/ModeSwitcher"
import { SaveButton } from "@/components/SaveButton"
import { Button } from "@/components/ui/button"
import { DEFAULT_PALETTE } from "@/lib/palettes"
import { LINEARTS, type LineArt as LineArtDef } from "@/lib/linearts"
import { useStrokeWidth } from "@/lib/useStrokeWidth"

type Point = { x: number; y: number }

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

  const [color, setColor] = useState(DEFAULT_PALETTE.colors[0])
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  // Portrait default until the decoded image gives us the real aspect ratio.
  const [aspect, setAspect] = useState(3 / 4)

  colorRef.current = color

  // Decode the line art once: it drives the fitted aspect ratio and is composited
  // over the color layer at save time.
  useEffect(() => {
    lineImgRef.current = null
    const img = new Image()
    img.onload = () => {
      lineImgRef.current = img
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

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
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

        {/* Only the color option is available in this mode. */}
        <ColorPalette value={color} onChange={setColor} />
      </div>
    </div>
  )
}
