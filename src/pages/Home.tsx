import type { ComponentType } from "react"
import { ArrowRight } from "lucide-react"

import { Card } from "@/components/ui/card"
import {
  FreeFormPreview,
  MandalaPreview,
  MirrorPreview,
  TilesPreview,
} from "@/components/ModePreviews"

type Mode = {
  id: string
  title: string
  href: string
  ready: boolean
  Preview: ComponentType<{ className?: string }>
}

const modes: Mode[] = [
  { id: "free-form", title: "Free form", href: "#/free-form", ready: true, Preview: FreeFormPreview },
  { id: "mandala", title: "Mandala", href: "#/mandala", ready: true, Preview: MandalaPreview },
  { id: "repetitive-tiles", title: "Tiles", href: "#/tiles", ready: true, Preview: TilesPreview },
  { id: "mirror", title: "Mirror", href: "#/mirror", ready: true, Preview: MirrorPreview },
]

export default function Home() {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background p-5 sm:p-8 lg:p-10">
      <header className="shrink-0">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
          Draw
        </h1>
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center py-4 sm:py-6">
        <div className="grid h-full max-h-[560px] w-full max-w-3xl grid-cols-2 grid-rows-2 gap-3 sm:gap-5">
          {modes.map(({ id, title, href, ready, Preview }) => (
            <a
              key={id}
              href={href}
              data-mode={id}
              aria-disabled={!ready}
              className="group min-h-0 focus-visible:outline-none"
            >
              <Card className="flex h-full flex-col overflow-hidden bg-muted/30 shadow-none transition-colors duration-200 group-hover:border-foreground/25 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <div className="flex min-h-0 flex-1 items-center justify-center p-4">
                  <Preview className="h-16 w-16 text-foreground/80 transition-transform duration-200 group-hover:scale-105 sm:h-20 sm:w-20" />
                </div>
                <div className="flex shrink-0 items-center gap-2 p-4 pt-0 sm:p-6 sm:pt-0">
                  <span className="text-lg font-bold tracking-tight sm:text-xl">
                    {title}
                  </span>
                  <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
                  {!ready && (
                    <span className="ml-auto text-xs font-medium text-muted-foreground">
                      Soon
                    </span>
                  )}
                </div>
              </Card>
            </a>
          ))}
        </div>
      </main>
    </div>
  )
}
