import { useEffect, useRef, useState, type ComponentType } from "react"
import { ArrowLeft, Check, Redo2, RotateCcw, Save, Undo2 } from "lucide-react"

import {
  FreeFormPreview,
  MandalaPreview,
  MirrorPreview,
  TilesPreview,
} from "@/components/ModePreviews"
import { ModeGuides } from "@/components/ModeGuides"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { lineCanvasToPngBlob, saveCustomLineArt } from "@/lib/customLinearts"
import type { DrawingMode } from "@/lib/drawings"
import {
  DEFAULT_SECTORS,
  DEFAULT_STROKE_WIDTH,
  getSymmetry,
  type Point,
  type Size,
  type SymParams,
} from "@/lib/symmetry"
import { cn } from "@/lib/utils"

// The template layer is always drawn in black, at a single (thicker) width.
const LINE_COLOR = "#18181b"
const STROKE_WIDTH = DEFAULT_STROKE_WIDTH

const MODES: {
  id: DrawingMode
  label: string
  Preview: ComponentType<{ className?: string }>
}[] = [
  { id: "free-form", label: "Free form", Preview: FreeFormPreview },
  { id: "mandala", label: "Mandala", Preview: MandalaPreview },
  { id: "tiles", label: "Tiles", Preview: TilesPreview },
  { id: "mirror", label: "Mirror", Preview: MirrorPreview },
]

// The template creator (for adults): a single black-ink line canvas drawn with a
// chosen symmetry, with undo/redo, clear, and save-to-library. Saved templates
// carry their mode + symmetry settings, so the kids' coloring modes replicate
// strokes the same way the lines were drawn.
export default function TemplateCreator() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const sizeRef = useRef<Size>({ w: 0, h: 0 })
  const drawingRef = useRef(false)
  const lastRef = useRef<Point | null>(null)
  const activePointerRef = useRef<number | null>(null)
  const savedRef = useRef(false)

  // Undo/redo: device-resolution snapshots captured at each stroke end.
  const historyRef = useRef<ImageData[]>([])
  const indexRef = useRef(-1)

  const [mode, setMode] = useState<DrawingMode>("free-form")
  const [modeMenuOpen, setModeMenuOpen] = useState(false)
  const [side, setSide] = useState(0)
  const [size, setSize] = useState<Size>({ w: 0, h: 0 })
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [confirmBack, setConfirmBack] = useState(false)

  const modeRef = useRef(mode)
  modeRef.current = mode

  // Mandala is the only mode with a parameter; keep a fixed default here.
  const params: SymParams = { sectors: DEFAULT_SECTORS }
  const activeMode = MODES.find((m) => m.id === mode) ?? MODES[0]

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

  // (Re)size the canvas when the side changes, preserving the drawing. History
  // resets to the (rescaled) current state.
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
    if (snapshot) ctx.drawImage(snapshot, 0, 0, rect.width, rect.height)

    sizeRef.current = { w: rect.width, h: rect.height }
    setSize({ w: rect.width, h: rect.height })
    resetHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side])

  function snapshot(): ImageData | null {
    const c = canvasRef.current
    const ctx = ctxRef.current
    if (!c || !ctx || c.width === 0) return null
    return ctx.getImageData(0, 0, c.width, c.height)
  }
  function updateFlags() {
    setCanUndo(indexRef.current > 0)
    setCanRedo(indexRef.current < historyRef.current.length - 1)
  }
  function resetHistory() {
    const snap = snapshot()
    if (!snap) return
    historyRef.current = [snap]
    indexRef.current = 0
    updateFlags()
  }
  function pushHistory() {
    const snap = snapshot()
    if (!snap) return
    historyRef.current = historyRef.current.slice(0, indexRef.current + 1)
    historyRef.current.push(snap)
    indexRef.current++
    updateFlags()
  }
  function restore(i: number) {
    const ctx = ctxRef.current
    const snap = historyRef.current[i]
    if (!ctx || !snap) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.putImageData(snap, 0, 0)
    ctx.restore()
    indexRef.current = i
    updateFlags()
  }
  function undo() {
    if (indexRef.current > 0) {
      restore(indexRef.current - 1)
      savedRef.current = false
    }
  }
  function redo() {
    if (indexRef.current < historyRef.current.length - 1) {
      restore(indexRef.current + 1)
      savedRef.current = false
    }
  }

  function clearCanvas() {
    const ctx = ctxRef.current
    const canvas = canvasRef.current
    if (!ctx || !canvas) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
  }
  function clear() {
    clearCanvas()
    savedRef.current = false
    pushHistory()
  }

  // Switching symmetry starts a fresh canvas (templates are one symmetry each).
  function selectMode(next: DrawingMode) {
    setModeMenuOpen(false)
    if (next === mode) return
    clearCanvas()
    savedRef.current = false
    setMode(next)
    resetHistory()
  }

  function stamp(a: Point, b: Point) {
    const ctx = ctxRef.current
    if (!ctx) return
    getSymmetry(modeRef.current, params).stampOn(ctx, a, b, {
      color: LINE_COLOR,
      strokeWidth: STROKE_WIDTH,
      size: sizeRef.current,
    })
  }

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointerRef.current !== null) return
    const p = pointFromEvent(e)
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
    savedRef.current = false
    pushHistory()
  }

  function hasInk(): boolean {
    const c = canvasRef.current
    const ctx = ctxRef.current
    if (!c || !ctx || c.width === 0) return false
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return true
    return false
  }

  // Saving publishes to the shared library, so it is a network round-trip that
  // can fail — only claim success once it lands.
  async function save() {
    const canvas = canvasRef.current
    const blob = canvas ? await lineCanvasToPngBlob(canvas) : null
    if (!blob) {
      toast({ message: "Draw something first", variant: "error" })
      return
    }
    try {
      await saveCustomLineArt({ mode, params, blob })
      savedRef.current = true
      toast({ message: "Shared to templates", variant: "success" })
    } catch {
      toast({ message: "Couldn't share template — check your connection", variant: "error" })
    }
  }

  function goBack() {
    if (window.history.length > 1) window.history.back()
    else window.location.hash = "#/mandala"
  }
  function handleBack() {
    if (hasInk() && !savedRef.current) setConfirmBack(true)
    else goBack()
  }

  // A round sidebar pill button, matching the coloring sidebar controls.
  const pill =
    "flex items-center justify-center rounded-full border bg-background p-2 text-foreground shadow-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
  const pillInner = "flex h-8 w-8 items-center justify-center sm:h-9 sm:w-9"

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-muted/30">
      <header className="z-10 flex shrink-0 items-center justify-between gap-3 border-b bg-background px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back"
            onClick={handleBack}
          >
            <ArrowLeft />
          </Button>
          <span className="text-base font-semibold tracking-tight sm:text-lg">
            New template
          </span>
        </div>

        <Button variant="outline" onClick={save}>
          <Save />
          Save to library
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col landscape:flex-row">
        <main
          ref={containerRef}
          className="flex min-h-0 flex-1 items-center justify-center p-4"
        >
          <div
            className="relative overflow-hidden rounded-lg border bg-white shadow-sm"
            style={{ width: side || undefined, height: side || undefined }}
          >
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endStroke}
              onPointerLeave={endStroke}
              onPointerCancel={endStroke}
            />
            <ModeGuides mode={mode} params={params} size={size} />
          </div>
        </main>

        {/* Sidebar: symmetry mode (single icon + popover), undo, redo, clear. */}
        <div className="flex shrink-0 items-center justify-center gap-3 p-2 landscape:order-first landscape:flex-col">
          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={modeMenuOpen}
              aria-label={`Symmetry mode: ${activeMode.label}`}
              onClick={() => setModeMenuOpen((o) => !o)}
              className={pill}
            >
              <span className={pillInner}>
                <activeMode.Preview className="h-6 w-6 text-foreground" />
              </span>
            </button>

            {modeMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setModeMenuOpen(false)}
                />
                <div
                  role="menu"
                  className={cn(
                    "absolute z-50 w-44 rounded-xl border bg-background p-1.5 shadow-lg",
                    // Portrait (bar at bottom): open upward, left-aligned.
                    "bottom-full left-0 mb-2",
                    // Landscape (bar on the left): open to the right, top-aligned.
                    "landscape:bottom-auto landscape:left-full landscape:top-0 landscape:mb-0 landscape:ml-2"
                  )}
                >
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      role="menuitem"
                      onClick={() => selectMode(m.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
                        m.id === mode ? "bg-muted" : "hover:bg-muted"
                      )}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
                        <m.Preview className="h-6 w-6 text-foreground" />
                      </span>
                      <span className="flex-1 text-left">{m.label}</span>
                      {m.id === mode && (
                        <Check className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            aria-label="Undo"
            onClick={undo}
            disabled={!canUndo}
            className={pill}
          >
            <span className={pillInner}>
              <Undo2 className="h-4 w-4" />
            </span>
          </button>
          <button
            type="button"
            aria-label="Redo"
            onClick={redo}
            disabled={!canRedo}
            className={pill}
          >
            <span className={pillInner}>
              <Redo2 className="h-4 w-4" />
            </span>
          </button>
          <button
            type="button"
            aria-label="Clear"
            onClick={clear}
            className={pill}
          >
            <span className={pillInner}>
              <RotateCcw className="h-4 w-4" />
            </span>
          </button>
        </div>
      </div>

      {confirmBack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setConfirmBack(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Discard template"
            className="relative w-full max-w-sm rounded-2xl border bg-background p-5 shadow-xl"
          >
            <h2 className="text-base font-semibold tracking-tight">
              Discard this template?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your drawing hasn't been saved and will be lost.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmBack(false)}>
                Keep drawing
              </Button>
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-600"
                onClick={goBack}
              >
                Discard
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
