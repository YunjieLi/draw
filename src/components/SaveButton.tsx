import { useState, type RefObject } from "react"
import { Check, Loader2, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { saveDrawing, type DrawingMode } from "@/lib/drawings"
import { isSupabaseConfigured } from "@/lib/supabase"

type Props = {
  canvasRef: RefObject<HTMLCanvasElement>
  mode: DrawingMode
}

type Status = "idle" | "saving" | "saved" | "error"

export function SaveButton({ canvasRef, mode }: Props) {
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)

  // Saving needs Supabase — hide the button entirely when it isn't configured.
  if (!isSupabaseConfigured) return null

  async function save() {
    const canvas = canvasRef.current
    if (!canvas || status === "saving") return
    setStatus("saving")
    setError(null)
    try {
      await saveDrawing(canvas, mode)
      setStatus("saved")
      // Reset back to the idle icon after a brief confirmation.
      setTimeout(() => setStatus("idle"), 1600)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.")
      setStatus("error")
      setTimeout(() => setStatus("idle"), 4000)
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Save to gallery"
        onClick={() => void save()}
        disabled={status === "saving"}
      >
        {status === "saving" ? (
          <Loader2 className="animate-spin" />
        ) : status === "saved" ? (
          <Check className="text-emerald-600" />
        ) : (
          <Save />
        )}
      </Button>

      {/* Inline feedback next to the button (kept out of the icon so layout
          stays stable). */}
      {status === "saved" && (
        <a
          href="#/gallery"
          className="hidden text-xs font-medium text-emerald-600 hover:underline sm:inline"
        >
          Saved · View
        </a>
      )}
      {status === "error" && error && (
        <span className="hidden max-w-[16rem] truncate text-xs text-red-600 sm:inline">
          {error}
        </span>
      )}
    </div>
  )
}
