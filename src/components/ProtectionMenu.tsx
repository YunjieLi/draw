import { useEffect, useRef, useState } from "react"
import { Check, MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"

// Header "…" overflow menu holding the boundary-("overflow")-protection toggle:
// when on, colour strokes stay inside the closed region they start in; when off,
// the brush paints freely.
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
          className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border bg-card p-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={protect}
            onClick={() => onChange(!protect)}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
          >
            <span className="flex-1">Overflow protection</span>
            {protect && <Check className="h-4 w-4 shrink-0" />}
          </button>
        </div>
      )}
    </div>
  )
}
