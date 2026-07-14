import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { FilePlus, LayoutGrid, RotateCcw, Trash2, X } from "lucide-react"

import { ColorPalette } from "@/components/ColorPalette"
import { ModeSwitcher } from "@/components/ModeSwitcher"
import { ProtectionMenu } from "@/components/ProtectionMenu"
import { SaveButton } from "@/components/SaveButton"
import { Button } from "@/components/ui/button"
import {
  EDGE_BLEED,
  beginClippedStroke,
  bleedUnderLines,
  buildClipCanvas,
  computeRegion,
  stampBbox,
  wallMaskFromPixels,
  type ClippedStroke,
} from "@/lib/boundaryProtection"
import {
  deleteCustomLineArt,
  getCustomLineartsSnapshot,
  modeLabel,
  subscribeCustomLinearts,
} from "@/lib/customLinearts"
import { DEFAULT_PALETTE } from "@/lib/palettes"
import { LINEARTS, type LineArt as LineArtDef } from "@/lib/linearts"
import { useStrokeWidth } from "@/lib/useStrokeWidth"

type Point = { x: number; y: number }

// The brush always paints freehand. "Boundary protection" (on by default)
// clips each stroke to the closed line-art region it starts in, so paint can't
// spill across the lines; turning it off gives an unrestricted brush. The
// region math lives in @/lib/boundaryProtection (shared with the other modes).

// --- Archived: bucket flood-fill helper, kept for possible reuse ---
// #rrggbb / #rgb -> [r, g, b]. Palette colors are always hex.
// function hexToRgb(hex: string): [number, number, number] {
//   let h = hex.replace("#", "")
//   if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
//   const n = parseInt(h, 16)
//   return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
// }

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

// Modal gallery of line arts. "Your sketches" (saved from the other modes, kept
// locally) come first, each tagged with the mode it was drawn in and removable;
// the bundled pages follow. Picking one loads it into the coloring view; closing
// it (backdrop, Escape, or the close button) resumes the drawing.
function LibraryModal({
  onPick,
  onClose,
}: {
  onPick: (art: LineArtDef) => void
  onClose: () => void
}) {
  const custom = useSyncExternalStore(
    subscribeCustomLinearts,
    getCustomLineartsSnapshot
  )

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

        <div className="min-h-0 flex-1 space-y-5 overflow-auto p-4 sm:p-5">
          {custom.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Your sketches
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {custom.map((art) => (
                  <div
                    key={art.id}
                    className="group relative overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md"
                  >
                    <button
                      type="button"
                      onClick={() => onPick({ id: `custom:${art.id}`, label: art.label, src: art.src })}
                      className="block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
                    >
                      <div className="aspect-[3/4] w-full">
                        <img
                          src={art.src}
                          alt={art.label}
                          draggable={false}
                          className="h-full w-full object-contain p-3 transition-transform group-hover:scale-[1.03]"
                        />
                      </div>
                    </button>
                    {/* Mode badge — the mode this sketch was drawn in. */}
                    <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
                      {modeLabel(art.mode)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Delete ${art.label}`}
                      onClick={() => deleteCustomLineArt(art.id)}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-muted-foreground opacity-0 shadow-sm transition hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <div className="space-y-0.5">
              {custom.length > 0 && (
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Coloring pages
                </h3>
              )}
              <p className="text-xs text-muted-foreground">
                Coloring pages courtesy of{" "}
                <a
                  href="https://yaycoloringpages.com"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-medium underline underline-offset-2 hover:text-foreground"
                >
                  yaycoloringpages.com
                </a>
              </p>
            </div>
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
          </section>
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
  // Bucket-fill boundary mask: 1 = line-art wall, 0 = fillable, sized to match
  // the backing canvas' device pixels. Rebuilt lazily and invalidated whenever
  // the canvas is resized or the art changes.
  const wallMaskRef = useRef<{ w: number; h: number; data: Uint8Array } | null>(
    null
  )
  // Active protected stroke: paints each move's segment clipped to its region,
  // touching only the segment's bounding box (see beginClippedStroke). Null when
  // not drawing a protected stroke (either idle, or protection is off).
  const protectedStrokeRef = useRef<ClippedStroke | null>(null)

  const [color, setColor] = useState(DEFAULT_PALETTE.colors[0])
  // Boundary protection keeps strokes inside the lines; on by default.
  const [protect, setProtect] = useState(true)
  const protectRef = useRef(true)
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  // Portrait default until the decoded image gives us the real aspect ratio.
  const [aspect, setAspect] = useState(3 / 4)

  colorRef.current = color
  protectRef.current = protect

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

    const mask = { w, h, data: wallMaskFromPixels(px, w, h) }
    wallMaskRef.current = mask
    return mask
  }

  // Map a CSS point (relative to the canvas) to a device-pixel index, or null
  // if it falls outside the backing canvas.
  function deviceIndex(cssX: number, cssY: number, w: number, h: number) {
    const rect = colorCanvasRef.current!.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    const sx = Math.floor((cssX / rect.width) * w)
    const sy = Math.floor((cssY / rect.height) * h)
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return null
    return sy * w + sx
  }

  // --- Archived: bucket tool. Fills the closed region under (cssX, cssY) with
  // the active color. Kept for possible reuse; also restore hexToRgb above.
  // function bucketFill(cssX: number, cssY: number) {
  //   const canvas = colorCanvasRef.current
  //   const ctx = colorCtxRef.current
  //   const mask = getWallMask()
  //   if (!canvas || !ctx || !mask) return
  //   const w = canvas.width
  //   const h = canvas.height
  //   const start = deviceIndex(cssX, cssY, w, h)
  //   if (start === null) return
  //   const region = computeRegion(mask.data, w, h, start)
  //   if (!region) return // tapped on a line — nothing to fill
  //   const [r, g, b] = hexToRgb(colorRef.current)
  //   const image = ctx.getImageData(0, 0, w, h)
  //   const d = image.data
  //   for (let i = 0; i < region.length; i++) {
  //     if (!region[i]) continue
  //     const p = i * 4
  //     d[p] = r
  //     d[p + 1] = g
  //     d[p + 2] = b
  //     d[p + 3] = 255
  //   }
  //   ctx.putImageData(image, 0, 0)
  // }

  // Begin a protected stroke: one that is clamped to the closed region under
  // its starting point. Returns false if the start sits on a line (or setup
  // fails), so the caller can decline to start a stroke.
  function beginProtectedStroke(start: Point): boolean {
    const canvas = colorCanvasRef.current
    const mask = getWallMask()
    if (!canvas || !mask) return false
    const w = canvas.width
    const h = canvas.height
    const idx = deviceIndex(start.x, start.y, w, h)
    if (idx === null) return false
    const region = computeRegion(mask.data, w, h, idx)
    if (!region) return false
    // Extend the region a few pixels under the line edges so paint covers the
    // antialiased fringe instead of leaving white slivers along the lines.
    const clipMask = bleedUnderLines(region, mask.data, w, h, EDGE_BLEED)

    // A clip layer that is opaque inside the region and transparent outside;
    // intersecting the stroke with it (destination-in) keeps paint in bounds.
    const clip = buildClipCanvas(clipMask, w, h)

    const ctx = colorCtxRef.current
    if (!ctx) return false
    const dpr = window.devicePixelRatio || 1
    protectedStrokeRef.current = beginClippedStroke(ctx, clip, dpr)
    return true
  }

  // Extend the active protected stroke from a→b, painting the new segment onto
  // the color layer clipped to the stroke's region (bounded to its bbox).
  function drawProtectedSegment(a: Point, b: Point) {
    const c = protectedStrokeRef.current
    const canvas = colorCanvasRef.current
    if (!c || !canvas) return
    const w = canvas.width
    const h = canvas.height
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return

    const bbox = stampBbox(
      [a, b],
      w / rect.width,
      h / rect.height,
      strokeRef.current
    )
    if (!bbox) return

    c.paint((ctx) => {
      ctx.strokeStyle = colorRef.current
      ctx.lineWidth = strokeRef.current
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }, bbox)
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointerRef.current !== null) return
    const p = pointFromEvent(e)
    if (protectRef.current) {
      // Protected: only start if the touch lands inside a region, not on a line.
      if (!beginProtectedStroke(p)) return
    }
    activePointerRef.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
    lastRef.current = p
    if (protectedStrokeRef.current) drawProtectedSegment(p, p)
    else stamp(p, p)
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== activePointerRef.current) return
    if (!drawingRef.current || !lastRef.current) return
    const p = pointFromEvent(e)
    if (protectedStrokeRef.current) drawProtectedSegment(lastRef.current, p)
    else stamp(lastRef.current, p)
    lastRef.current = p
  }

  function endStroke(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== activePointerRef.current) return
    drawingRef.current = false
    lastRef.current = null
    activePointerRef.current = null
    protectedStrokeRef.current = null
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
              className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
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
          footer={<ProtectionMenu protect={protect} onChange={setProtect} />}
        />
      </div>
    </div>
  )
}
