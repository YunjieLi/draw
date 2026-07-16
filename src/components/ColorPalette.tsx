import { useEffect, useRef, useState, type ReactNode } from "react"
import { ChevronRight, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"
import { DEFAULT_PALETTE_ID, PALETTES } from "@/lib/palettes"

type Props = {
  value: string
  onChange: (color: string) => void
  // Optional control rendered at the leading/top edge of the bar (before the
  // palette pill) — e.g. the "pick a template" button.
  leading?: ReactNode
  // Optional control rendered at the trailing/bottom edge of the bar (after the
  // palette pill) — e.g. an overflow "…" menu.
  footer?: ReactNode
}

// Color palette shown beside the canvas on the color layer (never overlapping
// it): a horizontal bar along the bottom on portrait viewports, and a vertical
// bar on the left on landscape ones. The swatches and the palette-picker entry
// live inside a single rounded "pill"; the picker chevron opens a popover for
// switching between named palettes (see @/lib/palettes).
export function ColorPalette({ value, onChange, leading, footer }: Props) {
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
        "flex shrink-0 items-center justify-center gap-3 p-2",
        // Landscape: move to the left as a full-height vertical column.
        "landscape:order-first landscape:flex-col"
      )}
    >
      {leading}

      {/* Single pill wrapping the swatches and the palette-picker entry. */}
      <div ref={menuRef} className="relative">
        <div
          className={cn(
            "flex items-center gap-2 rounded-full border bg-background p-2 shadow-sm",
            // Row of swatches in portrait, column in landscape.
            "landscape:flex-col"
          )}
        >
          {/* Palette-picker entry point — opens the named-palette popover. It
              sits outside the scroll area, so it stays pinned while the swatches
              scroll. The caret points the way the popover opens: up in portrait
              (it opens above), right in landscape (it opens to the side). */}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label="Choose color palette"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-muted hover:text-foreground sm:h-9 sm:w-9"
          >
            <ChevronUp className="h-4 w-4 landscape:hidden" />
            <ChevronRight className="hidden h-4 w-4 landscape:block" />
          </button>

          {/* Swatches scroll (hidden scrollbar) when there are more than fit —
              horizontally in portrait, vertically in landscape — so a large
              palette never pushes the rest of the bar off-screen. */}
          <div
            className={cn(
              "flex items-center gap-2 landscape:flex-col",
              "max-w-[calc(100vw-9rem)] overflow-auto landscape:max-w-none landscape:max-h-[calc(100dvh-14rem)]",
              "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            )}
          >
            {palette.colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                aria-label={`Color ${c}`}
                aria-pressed={value === c}
                className="h-8 w-8 shrink-0 rounded-full border border-black/10 sm:h-9 sm:w-9"
                style={{
                  backgroundColor: c,
                  // Selected: an inset ring (dark rim + light gap) drawn inside
                  // the swatch, so the highlight never spills past its bounds and
                  // gets clipped by the scroll container.
                  boxShadow:
                    value === c
                      ? "inset 0 0 0 2px hsl(var(--foreground)), inset 0 0 0 4px hsl(var(--background))"
                      : undefined,
                }}
              />
            ))}
          </div>
        </div>

        {open && (
          <div
            role="listbox"
            className={cn(
              "absolute z-20 max-h-[min(60vh,22rem)] w-60 overflow-y-auto rounded-lg border bg-card p-1 shadow-lg",
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
                <span className="flex flex-wrap gap-1.5">
                  {p.colors.map((c) => (
                    <span
                      key={c}
                      className="h-6 w-6 rounded-full border border-black/10"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {footer}
    </div>
  )
}
