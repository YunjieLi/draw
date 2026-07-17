import type { DrawingMode } from "@/lib/drawings"
import { LINEARTS_BUCKET, supabase } from "@/lib/supabase"
import {
  DEFAULT_SECTORS,
  clipToCircle,
  defaultParams,
  type SymParams,
} from "@/lib/symmetry"

// The shared template library: line art drawn in the template creator, by
// anyone, colourable by everyone. Rows live in `public.linearts` and the PNGs in
// the `linearts` storage bucket — public read, owner-only insert/delete (see
// supabase/schema.sql). Each row records the mode it was drawn in and its
// symmetry settings, so coloring replicates strokes the way the lines were.

// Where templates used to live: one device's browser, invisible to everyone
// else. Anything still under this key is published to the shared library on the
// next load that has a session to own it, then cleared. See migrateLegacyLocal.
const LEGACY_STORAGE_KEY = "draw:custom-linearts"

export type CustomLineArt = {
  id: string
  label: string
  mode: DrawingMode // the symmetry mode it was drawn in (and colors in)
  params: SymParams // symmetry settings (e.g. mandala sector count)
  src: string // public URL of the stored PNG
  createdAt: number
  userId: string // owner — only they may delete it
  storagePath: string
}

// A row of public.linearts.
type LineArtRow = {
  id: string
  user_id: string
  mode: DrawingMode
  sectors: number
  storage_path: string
  created_at: string
}

// The shape the old per-device store held.
type LegacyLineArt = { mode: DrawingMode; params?: SymParams; src: string }

const MODE_LABELS: Record<DrawingMode, string> = {
  "free-form": "Free form",
  mandala: "Mandala",
  tiles: "Tiles",
  mirror: "Mirror",
}

export function modeLabel(mode: DrawingMode): string {
  return MODE_LABELS[mode] ?? mode
}

// A cached snapshot with a stable identity between changes, so it can back a
// useSyncExternalStore subscription without re-render loops.
let snapshot: CustomLineArt[] = []
const listeners = new Set<() => void>()
let started = false

export function getCustomLineartsSnapshot(): CustomLineArt[] {
  return snapshot
}

export function subscribeCustomLinearts(onChange: () => void): () => void {
  listeners.add(onChange)
  if (!started) {
    started = true
    start()
  }
  return () => {
    listeners.delete(onChange)
  }
}

// Load the library, and keep it in step with auth. Visitors are signed in as
// anonymous guests asynchronously, so the session usually lands *after* the
// first read — and publishing legacy local templates needs an owner to attribute
// them to. Re-syncing on the auth event covers both.
function start() {
  void sync()
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) void sync()
  })
}

// Collapse overlapping syncs — the first load and the guest-session event race.
let syncing: Promise<void> | null = null

function sync(): Promise<void> {
  if (syncing) return syncing
  syncing = (async () => {
    try {
      // A failure here must not cost us the listing; the local copies are kept
      // and retried on the next load.
      await migrateLegacyLocal()
    } catch {
      /* retried next load */
    }
    try {
      await refresh()
    } finally {
      syncing = null
    }
  })()
  return syncing
}

async function refresh() {
  const { data, error } = await supabase
    .from("linearts")
    .select("*")
    .order("created_at", { ascending: false }) // newest first
  if (error) return
  snapshot = (data ?? []).map((row) => toArt(row as LineArtRow))
  listeners.forEach((fn) => fn())
}

function toArt(row: LineArtRow): CustomLineArt {
  return {
    id: row.id,
    label: `${modeLabel(row.mode)} template`,
    mode: row.mode,
    params: { sectors: row.sectors ?? DEFAULT_SECTORS },
    src: publicUrl(row.storage_path),
    createdAt: Date.parse(row.created_at),
    userId: row.user_id,
    storagePath: row.storage_path,
  }
}

// Upload a template PNG and insert its row. RLS ties both to the current user.
async function upload(
  mode: DrawingMode,
  params: SymParams,
  blob: Blob
): Promise<CustomLineArt> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    throw new Error(
      "No guest session. Enable Anonymous sign-ins in the Supabase dashboard " +
        "(Authentication → Sign In / Providers) to allow saving templates."
    )

  const path = `${user.id}/${crypto.randomUUID()}.png`
  const { error: uploadError } = await supabase.storage
    .from(LINEARTS_BUCKET)
    .upload(path, blob, { contentType: "image/png", upsert: false })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from("linearts")
    .insert({
      user_id: user.id,
      mode,
      sectors: params.sectors,
      storage_path: path,
    })
    .select()
    .single()

  if (error) {
    // Best-effort cleanup so we don't orphan the uploaded file.
    await supabase.storage.from(LINEARTS_BUCKET).remove([path])
    throw error
  }
  return toArt(data as LineArtRow)
}

export async function saveCustomLineArt(input: {
  mode: DrawingMode
  params?: SymParams
  blob: Blob
}): Promise<CustomLineArt> {
  const art = await upload(input.mode, input.params ?? defaultParams(), input.blob)
  await refresh()
  return art
}

// Delete a template's row and its stored file. RLS allows this for the owner
// only; for anyone else the delete matches no rows and the library is unchanged.
export async function deleteCustomLineArt(id: string): Promise<void> {
  const art = snapshot.find((a) => a.id === id)
  const { error } = await supabase.from("linearts").delete().eq("id", id)
  if (error) throw error
  if (art) await supabase.storage.from(LINEARTS_BUCKET).remove([art.storagePath])
  await refresh()
}

// Publish anything left in the old per-device store to the shared library, then
// clear it. Kept all-or-nothing on purpose: if any upload fails the local copy
// stays put, so the next load retries instead of dropping someone's art.
async function migrateLegacyLocal(): Promise<void> {
  const local = readLegacy()
  if (local.length === 0) return
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return // no owner yet — retried when the guest session lands

  for (const item of local) {
    const blob = await dataUrlToBlob(item.src)
    if (!blob) continue // unreadable entry; dropping it loses nothing we can use
    await upload(item.mode, item.params ?? defaultParams(), blob)
  }
  localStorage.removeItem(LEGACY_STORAGE_KEY)
}

function readLegacy(): LegacyLineArt[] {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    const list = raw ? (JSON.parse(raw) as LegacyLineArt[]) : []
    return Array.isArray(list) ? list.filter((x) => x && x.src && x.mode) : []
  } catch {
    return []
  }
}

async function dataUrlToBlob(src: string): Promise<Blob | null> {
  try {
    return await fetch(src).then((r) => r.blob())
  } catch {
    return null
  }
}

function publicUrl(path: string): string {
  return supabase.storage.from(LINEARTS_BUCKET).getPublicUrl(path).data.publicUrl
}

// Downscale a (device-resolution) line-layer canvas and encode it as a
// transparent PNG blob suitable for the library. `round` clips it to the circle
// the mode is drawn on (see isRoundCanvas). Returns null when the canvas has no
// ink (nothing drawn yet), so callers can decline to save.
export function lineCanvasToPngBlob(
  lineCanvas: HTMLCanvasElement,
  { max = 1000, round = false }: { max?: number; round?: boolean } = {}
): Promise<Blob | null> {
  const w = lineCanvas.width
  const h = lineCanvas.height
  if (w === 0 || h === 0) return Promise.resolve(null)
  const scale = Math.min(1, max / Math.max(w, h))
  const out = document.createElement("canvas")
  out.width = Math.max(1, Math.round(w * scale))
  out.height = Math.max(1, Math.round(h * scale))
  const ctx = out.getContext("2d")!
  if (round) clipToCircle(ctx, out.width, out.height)
  ctx.drawImage(lineCanvas, 0, 0, out.width, out.height)

  const px = ctx.getImageData(0, 0, out.width, out.height).data
  let hasInk = false
  for (let i = 3; i < px.length; i += 4)
    if (px[i] !== 0) {
      hasInk = true
      break
    }
  if (!hasInk) return Promise.resolve(null)

  return new Promise((resolve) => out.toBlob((blob) => resolve(blob), "image/png"))
}
