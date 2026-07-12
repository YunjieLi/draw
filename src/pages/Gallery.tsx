import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, Loader2, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/lib/auth"
import {
  deleteDrawing,
  listMyDrawings,
  type Drawing,
} from "@/lib/drawings"
import { isSupabaseConfigured } from "@/lib/supabase"

const MODE_LABELS: Record<Drawing["mode"], string> = {
  "free-form": "Free form",
  mandala: "Mandala",
  tiles: "Tiles",
  mirror: "Mirror",
}

export default function Gallery() {
  const { loading: authLoading } = useAuth()
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  async function remove(d: Drawing) {
    if (!confirm(`Delete "${d.title}"?`)) return
    try {
      await deleteDrawing(d)
      setDrawings((prev) => prev.filter((x) => x.id !== d.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete.")
    }
  }

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
        ) : drawings.length === 0 ? (
          <Centered>
            <p>No saved drawings yet.</p>
            <a href="#/" className="mt-4">
              <Button variant="outline">Start drawing</Button>
            </a>
          </Centered>
        ) : (
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {drawings.map((d) => (
              <Card key={d.id} className="group overflow-hidden">
                <div className="aspect-square bg-white">
                  <img
                    src={d.url}
                    alt={d.title}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="flex items-center gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {MODE_LABELS[d.mode]}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${d.title}`}
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
