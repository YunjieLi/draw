import { useState, type RefObject } from "react"
import { Check, Loader2, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { saveDrawing, type DrawingMode } from "@/lib/drawings"
import { isSupabaseConfigured } from "@/lib/supabase"
import { cn } from "@/lib/utils"

type Props = {
  canvasRef: RefObject<HTMLCanvasElement>
  mode: DrawingMode
}

export function SaveButton({ canvasRef, mode }: Props) {
  const [saveOpen, setSaveOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Saving needs Supabase — hide the button entirely when it isn't configured.
  if (!isSupabaseConfigured) return null

  function openSave() {
    setError(null)
    setDone(false)
    setTitle("")
    setSaveOpen(true)
  }

  async function doSave() {
    const canvas = canvasRef.current
    if (!canvas) return
    setBusy(true)
    setError(null)
    try {
      await saveDrawing(canvas, mode, title)
      setDone(true)
      setTimeout(() => setSaveOpen(false), 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Save drawing"
        onClick={openSave}
      >
        <Save />
      </Button>

      {saveOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !busy && setSaveOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Check className="h-5 w-5" />
                </span>
                <p className="text-sm font-medium">Saved to your gallery</p>
                <a href="#/gallery">
                  <Button variant="outline" size="sm">
                    View gallery
                  </Button>
                </a>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void doSave()
                }}
                className="flex flex-col gap-3"
              >
                <h2 className="text-lg font-semibold tracking-tight">
                  Save drawing
                </h2>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Title
                  <input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Untitled"
                    className={cn(
                      "h-9 rounded-md border border-input bg-background px-3 text-sm font-normal",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    )}
                  />
                </label>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="mt-1 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setSaveOpen(false)}
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={busy}>
                    {busy && <Loader2 className="animate-spin" />}
                    Save
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
