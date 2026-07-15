import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, Loader2, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/lib/auth"
import {
  deleteDrawing,
  listGalleryDrawings,
  type Drawing,
  type DrawingMode,
} from "@/lib/drawings"
import { isSupabaseConfigured } from "@/lib/supabase"
import { cn } from "@/lib/utils"

const MODE_LABELS: Record<DrawingMode, string> = {
  "free-form": "Free form",
  mandala: "Mandala",
  tiles: "Tiles",
  mirror: "Mirror",
}

const FILTERS: DrawingMode[] = ["free-form", "mandala", "tiles", "mirror"]

export default function Gallery() {
  const { user, loading: authLoading } = useAuth()
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Null until the user picks a tab; resolves to the first mode with drawings.
  const [filter, setFilter] = useState<DrawingMode | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDrawings(await listGalleryDrawings())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load drawings.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Wait for the guest session to settle so the query runs authenticated.
    if (!authLoading) void load()
  }, [authLoading, load])

  // Count per mode for the tab badges.
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const d of drawings) c[d.mode] = (c[d.mode] ?? 0) + 1
    return c
  }, [drawings])

  // Default the active tab to the first mode that actually has drawings.
  const activeFilter =
    filter ?? FILTERS.find((m) => (counts[m] ?? 0) > 0) ?? FILTERS[0]

  const visible = useMemo(
    () => drawings.filter((d) => d.mode === activeFilter),
    [drawings, activeFilter]
  )

  async function remove(d: Drawing) {
    if (!confirm("Delete this drawing?")) return
    try {
      await deleteDrawing(d)
      setDrawings((prev) => prev.filter((x) => x.id !== d.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete.")
    }
  }

  const ready = isSupabaseConfigured && !authLoading && !loading && !error
  const hasAny = drawings.length > 0

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-muted/30">
      <header className="z-10 flex shrink-0 items-center justify-between gap-3 border-b bg-background px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <a href="#/">
            <Button variant="ghost" size="icon" aria-label="Back to drawing">
              <ArrowLeft />
            </Button>
          </a>
          <span className="text-base font-semibold tracking-tight sm:text-lg">
            My gallery
          </span>
        </div>
      </header>

      {/* Filter tabs — one per mode; only meaningful once there are drawings. */}
      {ready && hasAny && (
        <div className="shrink-0 border-b bg-background px-3 py-2 sm:px-4">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((id) => {
              const count = counts[id] ?? 0
              const active = activeFilter === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {MODE_LABELS[id]}
                  <span
                    className={cn(
                      "ml-1.5 text-xs",
                      active ? "text-background/70" : "text-muted-foreground/70"
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-auto p-5 sm:p-8 lg:p-10">
        {!isSupabaseConfigured ? (
          <Centered>
            Supabase isn&apos;t configured yet. Add your keys to{" "}
            <code className="rounded bg-muted px-1">.env.local</code> to enable
            saving.
          </Centered>
        ) : authLoading || loading ? (
          <Centered>
            <Loader2 className="h-5 w-5 animate-spin" />
          </Centered>
        ) : error ? (
          <Centered>
            <p className="text-red-600">{error}</p>
            <Button className="mt-4" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </Centered>
        ) : !hasAny ? (
          <Centered>
            <p>No saved drawings yet.</p>
            <a href="#/" className="mt-4">
              <Button variant="outline">Start drawing</Button>
            </a>
          </Centered>
        ) : visible.length === 0 ? (
          <Centered>
            <p>No {MODE_LABELS[activeFilter]} drawings yet.</p>
          </Centered>
        ) : (
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {visible.map((d) => (
              <Card key={d.id} className="group relative overflow-hidden">
                <div className="aspect-square bg-white">
                  <img
                    src={d.url}
                    alt={MODE_LABELS[d.mode]}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                </div>
                {/* Only the owner can delete — RLS blocks deleting others' rows. */}
                {d.user_id === user?.id && (
                  <button
                    type="button"
                    aria-label="Delete drawing"
                    onClick={() => void remove(d)}
                    className="absolute right-2 top-2 rounded-md bg-background/80 p-1.5 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}
