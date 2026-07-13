import { useEffect, useRef, useState } from "react"
import {
  Check,
  FilePlus,
  LayoutGrid,
  MoreHorizontal,
  RotateCcw,
  Shield,
  ShieldOff,
  X,
} from "lucide-react"

import { ColorPalette } from "@/components/ColorPalette"
import { ModeSwitcher } from "@/components/ModeSwitcher"
import { SaveButton } from "@/components/SaveButton"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DEFAULT_PALETTE } from "@/lib/palettes"
import { LINEARTS, type LineArt as LineArtDef } from "@/lib/linearts"
import { useStrokeWidth } from "@/lib/useStrokeWidth"

type Point = { x: number; y: number }

// The brush always paints freehand. "Boundary protection" (on by default)
// clips each stroke to the closed line-art region it starts in, so paint can't
// spill across the lines; turning it off gives an unrestricted brush.

// The line art is pure black on a transparent background, but rasterizing it
// antialiases every edge into a short ramp of partial-alpha pixels. A pixel
// counts as a "wall" (a boundary a protected stroke can't cross) once its alpha
// clears this threshold — low enough that the barrier stays continuous across
// even thin lines.
const WALL_ALPHA = 60

// A protected stroke bleeds this many device pixels *under* the line edges,
// expanding only across wall pixels (never into a neighbouring region's
// interior). This paints beneath the semi-transparent antialiased fringe of the
// line overlay so no white slivers are left uncoloured along the lines. Kept
// small so it can't bridge a thin line into the region on its far side.
const EDGE_BLEED = 3

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

// Overflow "…" menu shown at the bottom of the palette bar. Holds the
// boundary-protection toggle: when on (the default), brush strokes stay inside
// the closed line-art region they start in; when off, the brush paints freely.
function ProtectionMenu({
  protect,
  onChange,
}: {
  protect: boolean
  onChange: (protect: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More options"
        onClick={() => setOpen((o) => !o)}
        // Padding + inner cell mirror the palette pill so this button matches
        // its width (a swatch-sized cell inside a p-2 border).
        className="flex items-center justify-center rounded-full border bg-background p-2 text-foreground shadow-sm transition-colors hover:bg-muted"
      >
        <span className="flex h-8 w-8 items-center justify-center sm:h-9 sm:w-9">
          <MoreHorizontal className="h-4 w-4" />
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-20 w-56 rounded-lg border bg-card p-1 shadow-lg",
            // Portrait (bar at bottom): open upward from the right edge.
            "bottom-full right-0 mb-2",
            // Landscape (bar on the left): open to the right, bottom-aligned.
            "landscape:inset-auto landscape:bottom-0 landscape:left-full landscape:right-auto landscape:mb-0 landscape:ml-2"
          )}
        >
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={protect}
            onClick={() => onChange(!protect)}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
          >
            {protect ? (
              <Shield className="h-4 w-4 shrink-0" />
            ) : (
              <ShieldOff className="h-4 w-4 shrink-0 opacity-60" />
            )}
            <span className="flex-1">Stay inside the lines</span>
            {protect && <Check className="h-4 w-4 shrink-0" />}
          </button>
        </div>
      )}
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
  // Active protected stroke: the region it's clamped to, plus the offscreen
  // layers used to keep painting inside that region. Null when not drawing a
  // protected stroke (either idle, or protection is off).
  const protectedStrokeRef = useRef<{
    clip: HTMLCanvasElement // opaque inside the region, transparent outside
    base: HTMLCanvasElement // color layer as it was when the stroke began
    stroke: HTMLCanvasElement // the current stroke, accumulated and clipped
    strokeCtx: CanvasRenderingContext2D
  } | null>(null)

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
    const data = new Uint8Array(w * h)
    for (let i = 0; i < data.length; i++)
      if (px[i * 4 + 3] >= WALL_ALPHA) data[i] = 1

    const mask = { w, h, data }
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

  // Flood the closed region containing `start` (a device-pixel index), bounded
  // by line-art walls. Returns a per-pixel mask (1 = in region), or null if
  // `start` sits on a wall.
  function computeRegion(mask: Uint8Array, w: number, h: number, start: number) {
    if (mask[start]) return null
    const region = new Uint8Array(w * h)
    const stack = [start]
    region[start] = 1
    while (stack.length) {
      const i = stack.pop()!
      const x = i % w
      const left = i - 1
      const right = i + 1
      const up = i - w
      const down = i + w
      if (x > 0 && !region[left] && !mask[left]) (region[left] = 1), stack.push(left)
      if (x < w - 1 && !region[right] && !mask[right])
        (region[right] = 1), stack.push(right)
      if (up >= 0 && !region[up] && !mask[up]) (region[up] = 1), stack.push(up)
      if (down < w * h && !region[down] && !mask[down])
        (region[down] = 1), stack.push(down)
    }
    return region
  }

  // Grow `region` outward by `bleed` pixels, but only across wall pixels — so
  // paint slides under the antialiased line edge yet can never reach the
  // fillable interior of an adjacent region. Returns the expanded mask.
  function bleedUnderLines(
    region: Uint8Array,
    wall: Uint8Array,
    w: number,
    h: number,
    bleed: number
  ) {
    const n = w * h
    const out = region.slice()
    // Seed the frontier with region pixels that touch a wall.
    let frontier: number[] = []
    for (let i = 0; i < n; i++) {
      if (!region[i]) continue
      const x = i % w
      if (
        (x > 0 && wall[i - 1]) ||
        (x < w - 1 && wall[i + 1]) ||
        (i - w >= 0 && wall[i - w]) ||
        (i + w < n && wall[i + w])
      )
        frontier.push(i)
    }
    for (let step = 0; step < bleed && frontier.length; step++) {
      const next: number[] = []
      for (const i of frontier) {
        const x = i % w
        const left = i - 1
        const right = i + 1
        const up = i - w
        const down = i + w
        if (x > 0 && !out[left] && wall[left]) (out[left] = 1), next.push(left)
        if (x < w - 1 && !out[right] && wall[right])
          (out[right] = 1), next.push(right)
        if (up >= 0 && !out[up] && wall[up]) (out[up] = 1), next.push(up)
        if (down < n && !out[down] && wall[down]) (out[down] = 1), next.push(down)
      }
      frontier = next
    }
    return out
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
    const clip = document.createElement("canvas")
    clip.width = w
    clip.height = h
    const clipImg = new ImageData(w, h)
    const cd = clipImg.data
    for (let i = 0; i < clipMask.length; i++)
      if (clipMask[i]) {
        cd[i * 4] = cd[i * 4 + 1] = cd[i * 4 + 2] = cd[i * 4 + 3] = 255
      }
    clip.getContext("2d")!.putImageData(clipImg, 0, 0)

    // Snapshot the color layer so each move can recomposite base + stroke
    // rather than accumulate.
    const base = document.createElement("canvas")
    base.width = w
    base.height = h
    base.getContext("2d")!.drawImage(canvas, 0, 0)

    const stroke = document.createElement("canvas")
    stroke.width = w
    stroke.height = h
    const strokeCtx = stroke.getContext("2d")!
    const dpr = window.devicePixelRatio || 1
    strokeCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    strokeCtx.lineCap = "round"
    strokeCtx.lineJoin = "round"

    protectedStrokeRef.current = { clip, base, stroke, strokeCtx }
    return true
  }

  // Extend the active protected stroke from a→b and recomposite it onto the
  // color layer, clipped to the stroke's region.
  function drawProtectedSegment(a: Point, b: Point) {
    const c = protectedStrokeRef.current
    const canvas = colorCanvasRef.current
    const ctx = colorCtxRef.current
    if (!c || !canvas || !ctx) return
    const w = canvas.width
    const h = canvas.height

    // Accumulate the new segment onto the stroke layer...
    c.strokeCtx.strokeStyle = colorRef.current
    c.strokeCtx.lineWidth = strokeRef.current
    c.strokeCtx.beginPath()
    c.strokeCtx.moveTo(a.x, a.y)
    c.strokeCtx.lineTo(b.x, b.y)
    c.strokeCtx.stroke()

    // ...then clip the whole stroke to the region.
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
