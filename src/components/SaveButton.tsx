import { useState, type RefObject } from "react"
import { Camera, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { saveDrawing, type DrawingMode } from "@/lib/drawings"
import { isSupabaseConfigured } from "@/lib/supabase"

type Props = {
  mode: DrawingMode
  // Single-canvas modes pass a ref; multi-layer modes (e.g. Mandala) pass a
  // compositor that flattens their layers into one canvas at save time.
  canvasRef?: RefObject<HTMLCanvasElement>
  getCanvas?: () => HTMLCanvasElement | null
}

export function SaveButton({ canvasRef, getCanvas, mode }: Props) {
  // Only the in-flight state lives inline (an icon swap, so no reflow); the
  // saved/error outcomes are announced via toast.
  const [saving, setSaving] = useState(false)

  // Saving needs Supabase — hide the button entirely when it isn't configured.
  if (!isSupabaseConfigured) return null

  async function save() {
    const canvas = getCanvas ? getCanvas() : (canvasRef?.current ?? null)
    if (!canvas || saving) return
    setSaving(true)
    try {
      await saveDrawing(canvas, mode)
      toast({
        message: "Saved to gallery",
        variant: "success",
        action: { label: "View", href: "#/gallery" },
      })
    } catch (err) {
      toast({
        message: err instanceof Error ? err.message : "Failed to save.",
        variant: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Save to gallery"
      onClick={() => void save()}
      disabled={saving}
    >
      {saving ? <Loader2 className="animate-spin" /> : <Camera />}
    </Button>
  )
}
