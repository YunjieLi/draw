import { useState } from "react"

import { cn } from "@/lib/utils"
import { DEFAULT_PALETTE_ID, PALETTES } from "@/lib/palettes"

type Props = {
  value: string
  onChange: (color: string) => void
}

// Color palette shown beside the canvas on the color layer (never overlapping
// it): a horizontal bar along the bottom on portrait viewports, and a vertical
// bar on the left on landscape ones. A dropdown at the start switches between
// named palettes (see @/lib/palettes).
export function ColorPalette({ value, onChange }: Props) {
  const [paletteId, setPaletteId] = useState(DEFAULT_PALETTE_ID)
  const palette = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0]

  function selectPalette(id: string) {
    const next = PALETTES.find((p) => p.id === id) ?? PALETTES[0]
    setPaletteId(next.id)
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
      <select
        value={paletteId}
        onChange={(e) => selectPalette(e.target.value)}
        aria-label="Color palette"
        className="max-w-[8.5rem] rounded-md border bg-background px-2 py-1.5 text-xs font-medium text-foreground shadow-sm sm:text-sm landscape:max-w-none"
      >
        {PALETTES.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <div
        className={cn(
          "flex flex-wrap items-center justify-center gap-2 sm:gap-3",
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
