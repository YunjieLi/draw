import { useEffect, useRef, useState } from "react"
import { ChevronDown, Palette as PaletteIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { DEFAULT_PALETTE_ID, PALETTES } from "@/lib/palettes"

type Props = {
  value: string
  onChange: (color: string) => void
}

// Color palette shown beside the canvas on the color layer (never overlapping
// it): a horizontal bar along the bottom on portrait viewports, and a vertical
// bar on the left on landscape ones. An icon button opens a popover for
// switching between named palettes (see @/lib/palettes); each option previews
// its full set of swatches.
export function ColorPalette({ value, onChange }: Props) {
  const [paletteId, setPaletteId] = useState(DEFAULT_PALETTE_ID)
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const palette = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0]

  // Close the popover on an outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  function selectPalette(id: string) {
    const next = PALETTES.find((p) => p.id === id) ?? PALETTES[0]
    setPaletteId(next.id)
    setOpen(false)
    // Keep the active color valid: if it isn't in the new palette, snap to the
    // first swatch so the selection ring and the brush stay in sync.
    if (!next.colors.includes(value)) onChange(next.colors[0])
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center gap-3 border-t bg-background p-3",
        // Landscape: move to the left as a full-height vertical column.
        "landscape:order-first landscape:flex-col landscape:border-r landscape:border-t-0"
      )}
    >
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Choose color palette"
          className="flex items-center gap-1 rounded-md border bg-background px-2 py-1.5 text-foreground shadow-sm transition-colors hover:bg-muted"
        >
          <PaletteIcon className="h-4 w-4" />
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>

        {open && (
          <div
            role="listbox"
            className={cn(
              "absolute z-20 max-h-[min(60vh,22rem)] w-56 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg",
              // Portrait (bar at bottom): open upward, aligned to the left edge.
              "bottom-full left-0 mb-2",
              // Landscape (bar on the left): open to the right, aligned to top.
              "landscape:bottom-auto landscape:left-full landscape:top-0 landscape:mb-0 landscape:ml-2"
            )}
          >
            {PALETTES.map((p) => (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={p.id === paletteId}
                onClick={() => selectPalette(p.id)}
                className={cn(
                  "flex w-full flex-col gap-1.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted",
                  p.id === paletteId && "bg-muted"
                )}
              >
                <span className="text-xs font-medium text-foreground">
                  {p.name}
                </span>
                <span className="flex flex-wrap gap-1">
                  {p.colors.map((c) => (
                    <span
                      key={c}
                      className="h-4 w-4 rounded-full border border-black/10"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Padding leaves room for the selected swatch's ring so it isn't clipped
          by the scroll container's edges. */}
      <div
        className={cn(
          "flex flex-wrap items-center justify-center gap-2 p-2 sm:gap-3",
          "landscape:flex-col landscape:flex-nowrap landscape:overflow-y-auto"
        )}
      >
        {palette.colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`Color ${c}`}
            className={cn(
              "h-8 w-8 shrink-0 rounded-full border transition-transform hover:scale-110 sm:h-9 sm:w-9",
              value === c
                ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                : "border-black/10"
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  )
}
