import { useEffect, useRef, useState } from "react"
import { Check, MoreHorizontal, Shield, ShieldOff } from "lucide-react"

import { cn } from "@/lib/utils"

// Overflow "…" menu shown at the bottom of the palette bar. Holds the
// boundary-protection toggle: when on, brush strokes stay inside the closed
// line-art region they start in; when off, the brush paints freely.
export function ProtectionMenu({
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
