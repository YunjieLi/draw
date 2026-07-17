import { useEffect, useSyncExternalStore } from "react"
import { Plus, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { useAuth } from "@/lib/auth"
import {
  deleteCustomLineArt,
  getCustomLineartsSnapshot,
  modeLabel,
  subscribeCustomLinearts,
} from "@/lib/customLinearts"
import { LINEARTS } from "@/lib/linearts"
import { publishTemplate } from "@/lib/templateStore"

// Modal gallery of templates. "Your templates" (saved from the drawing modes,
// kept locally) come first, each tagged with the mode it was drawn in and
// removable; the bundled pages follow. Picking one publishes it and routes to
// the right mode: a custom template opens in the mode it was made in, a bundled
// (imported) asset opens as free-form. Closing (backdrop, Escape, ✕) dismisses.
export function TemplateModal({ onClose }: { onClose: () => void }) {
  const custom = useSyncExternalStore(
    subscribeCustomLinearts,
    getCustomLineartsSnapshot
  )
  // Templates are everyone's to color but only their author's to delete, which
  // is what the RLS policy enforces; this just hides a button that would fail.
  const { user } = useAuth()

  function remove(id: string) {
    deleteCustomLineArt(id).catch(() =>
      toast({ message: "Couldn't delete template", variant: "error" })
    )
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  function pick(
    src: string,
    mode: Parameters<typeof publishTemplate>[1],
    params?: Parameters<typeof publishTemplate>[2]
  ) {
    publishTemplate(src, mode, params)
    onClose()
  }

  function createNew() {
    window.location.hash = "#/new-template"
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Click-away backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Template library"
        className="relative flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border bg-background shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold tracking-tight sm:text-lg">
            Pick a template to color in
          </h2>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-auto p-4 sm:p-5">
          {/* Create a new template (for adults) — opens the template creator. */}
          <button
            type="button"
            onClick={createNew}
            className="flex w-full items-center gap-3 rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background">
              <Plus className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold">
                Create a new template
              </span>
              <span className="block text-xs text-muted-foreground">
                Draw your own line art to color in
              </span>
            </span>
          </button>

          {custom.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Templates
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {custom.map((art) => (
                  <div
                    key={art.id}
                    className="group relative overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md"
                  >
                    <button
                      type="button"
                      onClick={() => pick(art.src, art.mode, art.params)}
                      className="block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
                    >
                      <div className="aspect-[3/4] w-full">
                        <img
                          src={art.src}
                          alt={art.label}
                          draggable={false}
                          className="h-full w-full object-contain p-3 transition-transform group-hover:scale-[1.03]"
                        />
                      </div>
                    </button>
                    {/* Mode badge — the mode this template was drawn in. */}
                    <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
                      {modeLabel(art.mode)}
                    </span>
                    {user?.id === art.userId && (
                      <button
                        type="button"
                        aria-label={`Delete ${art.label}`}
                        onClick={() => remove(art.id)}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-muted-foreground opacity-0 shadow-sm transition hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Bundled pages, and the credit for them — both only while there are
              any. The registry globs src/linearts, so dropping the art back in
              brings this section back with it. */}
          {LINEARTS.length > 0 && (
            <section className="space-y-2">
              <div className="space-y-0.5">
                {custom.length > 0 && (
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Coloring pages
                  </h3>
                )}
                <p className="text-xs text-muted-foreground">
                  Coloring pages courtesy of{" "}
                  <a
                    href="https://yaycoloringpages.com"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-medium underline underline-offset-2 hover:text-foreground"
                  >
                    yaycoloringpages.com
                  </a>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {LINEARTS.map((art) => (
                  <button
                    key={art.id}
                    type="button"
                    onClick={() => pick(art.src, "free-form")}
                    className="group overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
                  >
                    <div className="aspect-[3/4] w-full">
                      <img
                        src={art.src}
                        alt={art.label}
                        loading="lazy"
                        draggable={false}
                        className="h-full w-full object-contain p-3 transition-transform group-hover:scale-[1.03]"
                      />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
