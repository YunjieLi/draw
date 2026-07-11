import type { ComponentType } from "react"
import { ArrowUpRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  FreeFormPreview,
  MandalaPreview,
  MirrorPreview,
  TilesPreview,
} from "@/components/ModePreviews"

type Mode = {
  id: string
  title: string
  description: string
  Preview: ComponentType<{ className?: string }>
}

const modes: Mode[] = [
  {
    id: "free-form",
    title: "Free Form",
    description: "Just you and the canvas. Draw anything, no rules.",
    Preview: FreeFormPreview,
  },
  {
    id: "mandala",
    title: "Mandala",
    description: "Radial symmetry — every stroke blooms around the center.",
    Preview: MandalaPreview,
  },
  {
    id: "repetitive-tiles",
    title: "Repetitive Tiles",
    description: "Draw once, repeat across a seamless grid of tiles.",
    Preview: TilesPreview,
  },
  {
    id: "mirror",
    title: "Mirror",
    description: "Reflect every line across an axis for instant balance.",
    Preview: MirrorPreview,
  },
]

function App() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6">
        <header className="pt-24 pb-14 text-center">
          <Badge variant="secondary" className="mb-5 font-normal">
            Symmetry Studio
          </Badge>
          <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
            Draw
          </h1>
          <p className="mx-auto mt-4 max-w-md text-balance text-lg text-muted-foreground">
            A playground for symmetry, pattern, and freeform sketching.
          </p>
        </header>

        <main className="pb-20">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {modes.map(({ id, title, description, Preview }) => (
              <a key={id} href="#" data-mode={id} className="group block">
                <Card className="overflow-hidden transition-all duration-200 group-hover:border-foreground/20 group-hover:shadow-md">
                  <div className="flex items-center justify-center border-b bg-muted/40 py-10">
                    <Preview className="h-24 w-24 text-foreground/80 transition-transform duration-200 group-hover:scale-105" />
                  </div>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{title}</CardTitle>
                      <Badge variant="outline" className="font-normal text-muted-foreground">
                        Soon
                      </Badge>
                    </div>
                    <CardDescription className="text-balance">
                      {description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                      Open mode
                      <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </span>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        </main>

        <footer className="border-t py-8 text-center text-sm text-muted-foreground">
          <p>
            Made for the joy of drawing ·{" "}
            <a
              href="https://github.com/YunjieLi/draw"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              source
            </a>
          </p>
        </footer>
      </div>
    </div>
  )
}

export default App
