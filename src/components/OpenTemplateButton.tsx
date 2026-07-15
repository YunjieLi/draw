import { VenetianMask } from "lucide-react"

// Sidebar pill that opens the "From template" modal to pick a template to color
// in. Styled to match the palette's "…" menus so the two template actions
// (open / save) sit together.
export function OpenTemplateButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      aria-label="Pick a template to color in"
      onClick={onOpen}
      className="flex items-center justify-center rounded-full border bg-background p-2 text-foreground shadow-sm transition-colors hover:bg-muted"
    >
      <span className="flex h-8 w-8 items-center justify-center sm:h-9 sm:w-9">
        <VenetianMask className="h-4 w-4" />
      </span>
    </button>
  )
}
