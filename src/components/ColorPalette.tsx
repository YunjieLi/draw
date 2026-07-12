import { cn } from "@/lib/utils"

type Props = {
  colors: readonly string[]
  value: string
  onChange: (color: string) => void
}

// Color palette shown beside the canvas on the color layer (never overlapping
// it): a horizontal bar along the bottom on portrait viewports, and a vertical
// bar on the left on landscape ones.
export function ColorPalette({ colors, value, onChange }: Props) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center gap-2 border-t bg-background p-3 sm:gap-3",
        // Landscape: move to the left as a full-height vertical column.
        "landscape:order-first landscape:flex-col landscape:border-r landscape:border-t-0"
      )}
    >
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={`Color ${c}`}
          className={cn(
            "h-8 w-8 rounded-full border transition-transform hover:scale-110 sm:h-9 sm:w-9",
            value === c
              ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
              : "border-black/10"
          )}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  )
}
