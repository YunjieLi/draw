import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, Loader2, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/lib/auth"
import {
  deleteDrawing,
  listMyDrawings,
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

// Tab order: "all" first, then the four modes.
const FILTERS: Array<{ id: "all" | DrawingMode; label: string }> = [
  { id: "all", label: "All" },
  { id: "free-form", label: "Free form" },
  { id: "mandala", label: "Mandala" },
  { id: "tiles", label: "Tiles" },
  { id: "mirror", label: "Mirror" },
]

export default function Gallery() {
  const { loading: authLoading } = useAuth()
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | DrawingMode>("all")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDrawings(await listMyDrawings())
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
    const c: Record<string, number> = { all: drawings.length }
    for (const d of drawings) c[d.mode] = (c[d.mode] ?? 0) + 1
    return c
  }, [drawings])

  const visible = useMemo(
    () => (filter === "all" ? drawings : drawings.filter((d) => d.mode === filter)),
    [drawings, filter]
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
            <Button variant="ghost" size="icon" aria-label="Back">
              <ArrowLeft />
            </Button>
          </a>
          <span className="text-base font-semibold tracking-tight sm:text-lg">
            My gallery
          </span>
        </div>
      </header>

      {/* Filter tabs — only meaningful once there are drawings. */}
      {ready && hasAny && (
        <div className="shrink-0 border-b bg-background px-3 py-2 sm:px-4">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const count = counts[f.id] ?? 0
              const active = filter === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {f.label}
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
            <p>No {MODE_LABELS[filter as DrawingMode]} drawings yet.</p>
          </Centered>
        ) : (
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {visible.map((d) => (
              <Card key={d.id} className="group overflow-hidden">
                <div className="aspect-square bg-white">
                  <img
                    src={d.url}
                    alt={MODE_LABELS[d.mode]}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="flex items-center gap-2 p-3">
                  <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {MODE_LABELS[d.mode]}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete drawing"
                    onClick={() => void remove(d)}
                    className="shrink-0 text-muted-foreground hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
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
