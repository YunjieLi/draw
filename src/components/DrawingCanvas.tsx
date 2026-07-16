import { useState } from "react"
import { LayoutGrid, RotateCcw } from "lucide-react"

import { ColorPalette } from "@/components/ColorPalette"
import { ModeGuides } from "@/components/ModeGuides"
import { ModeSwitcher } from "@/components/ModeSwitcher"
import { OpenTemplateButton } from "@/components/OpenTemplateButton"
import { ProtectionMenu } from "@/components/ProtectionMenu"
import { SaveButton } from "@/components/SaveButton"
import { TemplateModal } from "@/components/TemplateModal"
import { Button } from "@/components/ui/button"
import type { DrawingCanvas as DrawingCanvasState } from "@/lib/useDrawingCanvas"
import { cn } from "@/lib/utils"

type Props = {
  // The engine bindings from useDrawingCanvas.
  dc: DrawingCanvasState
}

// The shared shell for the four coloring modes: header (mode switcher, clear,
// save, library), the colour canvas over an optional read-only template with the
// mode's symmetry guides, and the palette (led by the "pick a template" button).
export function DrawingCanvas({ dc }: Props) {
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const openTemplates = () => setTemplatesOpen(true)
  const circle = dc.mode === "mandala"

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-muted/30">
      {/* Controls row */}
      <header className="z-10 flex shrink-0 items-center justify-between gap-3 border-b bg-background px-3 py-2 sm:px-4 sm:py-3">
        <ModeSwitcher current={dc.mode} />

        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear all"
            onClick={dc.clear}
          >
            <RotateCcw />
          </Button>

          <ProtectionMenu protect={dc.protect} onChange={dc.setProtect} />

          <span className="h-6 w-px bg-border" />

          <SaveButton getCanvas={dc.composeLayers} mode={dc.mode} />

          <a href="#/gallery">
            <Button variant="outline">
              <LayoutGrid />
              Library
            </Button>
          </a>
        </div>
      </header>

      {/* Drawing area — palette sits beside the canvas (bottom on portrait,
          left on landscape), never overlapping it. */}
      <div className="flex min-h-0 flex-1 flex-col landscape:flex-row">
        <main
          ref={dc.containerRef}
          className="flex min-h-0 flex-1 items-center justify-center p-4"
        >
          <div
            className={cn(
              "relative overflow-hidden border bg-white shadow-sm",
              circle ? "rounded-full" : "rounded-lg"
            )}
            style={{ width: dc.side || undefined, height: dc.side || undefined }}
          >
            {/* Colour layer (bottom) — the top canvas captures pointer events. */}
            <canvas
              ref={dc.colorCanvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
            {/* Template layer (top) — read-only, shows the lines to colour in. */}
            <canvas
              ref={dc.lineCanvasRef}
              className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
              onPointerDown={dc.onPointerDown}
              onPointerMove={dc.onPointerMove}
              onPointerUp={dc.endStroke}
              onPointerLeave={dc.endStroke}
              onPointerCancel={dc.endStroke}
            />
            <ModeGuides mode={dc.mode} params={dc.params} size={dc.size} />
          </div>
        </main>

        <ColorPalette
          value={dc.color}
          onChange={dc.setColor}
          leading={<OpenTemplateButton onOpen={openTemplates} />}
        />
      </div>

      {templatesOpen && (
        <TemplateModal onClose={() => setTemplatesOpen(false)} />
      )}
    </div>
  )
}
