import { useEffect, useRef, useState } from "react"
import { Check, ImagePlus, MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  lineCanvasToDataUrl,
  saveCustomLineArt,
} from "@/lib/customLinearts"
import type { DrawingMode } from "@/lib/drawings"

type Props = {
  mode: DrawingMode
  // The line layer to capture (its black strokes become the coloring page).
  getLineCanvas: () => HTMLCanvasElement | null
}

type Status = "idle" | "saved" | "empty"

// Overflow "…" menu (to the right of the camera) whose one item saves the
// current line layer into the local line-art library, tagged with this mode.
export function SaveLineArtMenu({ mode, getLineCanvas }: Props) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>("idle")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      setStatus("idle")
      return
    }
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

  function save() {
    const canvas = getLineCanvas()
    const src = canvas ? lineCanvasToDataUrl(canvas) : null
    if (!src) {
      setStatus("empty")
      return
    }
    saveCustomLineArt({ mode, src })
    setStatus("saved")
    setTimeout(() => setOpen(false), 1200)
  }

  const label =
    status === "saved"
      ? "Added to library"
      : status === "empty"
        ? "Draw some lines first"
        : "Save this line art to the coloring library"

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More options"
        onClick={() => setOpen((o) => !o)}
      >
        <MoreHorizontal />
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-64 rounded-lg border bg-card p-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={save}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
          >
            {status === "saved" ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <ImagePlus className="h-4 w-4 shrink-0" />
            )}
            <span
              className={cn(
                "flex-1",
                status === "empty" && "text-muted-foreground"
              )}
            >
              {label}
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
