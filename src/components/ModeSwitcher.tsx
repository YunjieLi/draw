import { useEffect, useState, type ComponentType } from "react"
import { Check, ChevronDown } from "lucide-react"

import {
  FreeFormPreview,
  MandalaPreview,
  MirrorPreview,
  TilesPreview,
} from "@/components/ModePreviews"
import { Button } from "@/components/ui/button"
import type { DrawingMode } from "@/lib/drawings"
import { cn } from "@/lib/utils"

type ModeDef = {
  id: DrawingMode
  label: string
  href: string
  Preview: ComponentType<{ className?: string }>
}

const MODES: ModeDef[] = [
  { id: "free-form", label: "Free form", href: "#/free-form", Preview: FreeFormPreview },
  { id: "mandala", label: "Mandala", href: "#/mandala", Preview: MandalaPreview },
  { id: "tiles", label: "Tiles", href: "#/tiles", Preview: TilesPreview },
  { id: "mirror", label: "Mirror", href: "#/mirror", Preview: MirrorPreview },
]

// Top-left control: shows the current mode and opens a popover to switch modes.
export function ModeSwitcher({ current }: { current: DrawingMode }) {
  const [open, setOpen] = useState(false)
  const active = MODES.find((m) => m.id === current) ?? MODES[1]

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <div className="relative">
      <Button
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="gap-2 px-2 sm:px-2.5"
      >
        <active.Preview className="h-5 w-5 text-foreground" />
        <span className="text-base font-semibold tracking-tight sm:text-lg">
          {active.label}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </Button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border bg-background p-1.5 shadow-lg"
          >
            {MODES.map((m) => {
              const isCurrent = m.id === current
              return (
                <a
                  key={m.id}
                  href={m.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2 py-2 text-base font-medium transition-colors",
                    isCurrent ? "bg-muted" : "hover:bg-muted"
                  )}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
                    <m.Preview className="h-9 w-9 text-foreground" />
                  </span>
                  <span className="flex-1">{m.label}</span>
                  {isCurrent && (
                    <Check className="mr-1 h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                </a>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
