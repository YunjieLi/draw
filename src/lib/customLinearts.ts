import type { DrawingMode } from "@/lib/drawings"
import { defaultParams, type SymParams } from "@/lib/symmetry"

// User-created templates, saved locally (per device) so they show up in the
// "From template" modal next to the bundled pages. Each records the mode it was
// drawn in and its symmetry settings, so coloring replicates strokes the way
// the lines were drawn.
const STORAGE_KEY = "draw:custom-linearts"

export type CustomLineArt = {
  id: string
  label: string
  mode: DrawingMode // the symmetry mode it was drawn in (and colors in)
  params: SymParams // symmetry settings (e.g. mandala sector count)
  src: string // data URL: PNG, black lines on a transparent background
  createdAt: number
}

const MODE_LABELS: Record<DrawingMode, string> = {
  "free-form": "Free form",
  mandala: "Mandala",
  tiles: "Tiles",
  mirror: "Mirror",
}

export function modeLabel(mode: DrawingMode): string {
  return MODE_LABELS[mode] ?? mode
}

function load(): CustomLineArt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const list = raw ? (JSON.parse(raw) as CustomLineArt[]) : []
    return list
      .map((item) => ({ ...item, params: item.params ?? defaultParams() }))
      .sort((a, b) => b.createdAt - a.createdAt) // newest first
  } catch {
    return []
  }
}

// A cached snapshot with a stable identity between changes, so it can back a
// useSyncExternalStore subscription without re-render loops.
let snapshot: CustomLineArt[] = load()
const listeners = new Set<() => void>()

function onStorage(e: StorageEvent) {
  if (e.key !== STORAGE_KEY) return
  snapshot = load()
  listeners.forEach((fn) => fn())
}

function commit(list: CustomLineArt[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  snapshot = load()
  listeners.forEach((fn) => fn())
}

export function getCustomLineartsSnapshot(): CustomLineArt[] {
  return snapshot
}

export function subscribeCustomLinearts(onChange: () => void): () => void {
  listeners.add(onChange)
  if (listeners.size === 1) window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(onChange)
    if (listeners.size === 0) window.removeEventListener("storage", onStorage)
  }
}

export function saveCustomLineArt(input: {
  mode: DrawingMode
  params?: SymParams
  src: string
}): CustomLineArt {
  const item: CustomLineArt = {
    id: crypto.randomUUID(),
    label: `${modeLabel(input.mode)} template`,
    mode: input.mode,
    params: input.params ?? defaultParams(),
    src: input.src,
    createdAt: Date.now(),
  }
  commit([item, ...load()])
  return item
}

export function deleteCustomLineArt(id: string) {
  commit(load().filter((x) => x.id !== id))
}

// Downscale a (device-resolution) line-layer canvas and encode it as a
// transparent PNG data URL suitable for the coloring library. Returns null when
// the canvas has no ink (nothing drawn yet), so callers can decline to save.
export function lineCanvasToDataUrl(
  lineCanvas: HTMLCanvasElement,
  max = 1000
): string | null {
  const w = lineCanvas.width
  const h = lineCanvas.height
  if (w === 0 || h === 0) return null
  const scale = Math.min(1, max / Math.max(w, h))
  const out = document.createElement("canvas")
  out.width = Math.max(1, Math.round(w * scale))
  out.height = Math.max(1, Math.round(h * scale))
  const ctx = out.getContext("2d")!
  ctx.drawImage(lineCanvas, 0, 0, out.width, out.height)

  const px = ctx.getImageData(0, 0, out.width, out.height).data
  let hasInk = false
  for (let i = 3; i < px.length; i += 4)
    if (px[i] !== 0) {
      hasInk = true
      break
    }
  if (!hasInk) return null

  return out.toDataURL("image/png")
}
