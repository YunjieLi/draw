import { DRAWINGS_BUCKET, supabase } from "@/lib/supabase"

export type DrawingMode = "free-form" | "mandala" | "tiles" | "mirror"

export type Drawing = {
  id: string
  user_id: string
  mode: DrawingMode
  storage_path: string
  created_at: string
  // Resolved public URL for the stored PNG (added client-side).
  url: string
}

// Flatten the transparent drawing canvas onto a white background and encode a
// PNG blob. The modes draw on a transparent canvas layered over a white div, so
// exporting the canvas alone would lose the background.
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const flat = document.createElement("canvas")
  flat.width = canvas.width
  flat.height = canvas.height
  const ctx = flat.getContext("2d")!
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, flat.width, flat.height)
  ctx.drawImage(canvas, 0, 0)

  return new Promise((resolve, reject) => {
    flat.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("Failed to encode canvas as PNG"))
    }, "image/png")
  })
}

// Upload a PNG and insert its metadata row. RLS ties both to the current user.
export async function saveDrawing(
  canvas: HTMLCanvasElement,
  mode: DrawingMode
): Promise<Drawing> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    throw new Error(
      "No guest session. Enable Anonymous sign-ins in the Supabase dashboard " +
        "(Authentication → Sign In / Providers) to allow saving."
    )

  const blob = await canvasToPngBlob(canvas)
  const path = `${user.id}/${crypto.randomUUID()}.png`

  const { error: uploadError } = await supabase.storage
    .from(DRAWINGS_BUCKET)
    .upload(path, blob, { contentType: "image/png", upsert: false })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from("drawings")
    .insert({
      user_id: user.id,
      mode,
      storage_path: path,
    })
    .select()
    .single()

  if (error) {
    // Best-effort cleanup so we don't orphan the uploaded file.
    await supabase.storage.from(DRAWINGS_BUCKET).remove([path])
    throw error
  }

  return { ...(data as Omit<Drawing, "url">), url: publicUrl(path) }
}

// List every saved drawing in the shared gallery, newest first. The read RLS
// policy is public (see supabase/schema.sql), so this returns all users' rows.
export async function listGalleryDrawings(): Promise<Drawing[]> {
  const { data, error } = await supabase
    .from("drawings")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw error

  return (data ?? []).map((row) => ({
    ...(row as Omit<Drawing, "url">),
    url: publicUrl((row as { storage_path: string }).storage_path),
  }))
}

// Delete a drawing's row and its stored file.
export async function deleteDrawing(drawing: Drawing): Promise<void> {
  const { error } = await supabase.from("drawings").delete().eq("id", drawing.id)
  if (error) throw error
  await supabase.storage.from(DRAWINGS_BUCKET).remove([drawing.storage_path])
}

function publicUrl(path: string): string {
  return supabase.storage.from(DRAWINGS_BUCKET).getPublicUrl(path).data.publicUrl
}
