import type { ReactNode } from "react"
import { LayoutGrid, RotateCcw } from "lucide-react"

import { ColorPalette } from "@/components/ColorPalette"
import { ModeSwitcher } from "@/components/ModeSwitcher"
import { ProtectionMenu } from "@/components/ProtectionMenu"
import { SaveButton } from "@/components/SaveButton"
import { SaveLineArtMenu } from "@/components/SaveLineArtMenu"
import { Button } from "@/components/ui/button"
import type { DrawingMode } from "@/lib/drawings"
import type { DrawingCanvas as DrawingCanvasState, Layer } from "@/lib/useDrawingCanvas"
import { cn } from "@/lib/utils"

type Props = {
  // The engine bindings from useDrawingCanvas.
  dc: DrawingCanvasState
  // Which mode this is — drives the switcher, save, and save-to-library actions.
  mode: DrawingMode
  // "circle" for the mandala's round canvas; "square" (default) for the rest.
  shape?: "square" | "circle"
  // Mode-specific overlay drawn above the canvases (e.g. sector or tile guides),
  // sized to `dc.size`. Rendered pointer-transparent so strokes fall through.
  guides?: ReactNode
}

// The shared shell for the symmetry drawing modes: header (mode switcher, layer
// toggle, clear, save, library), the stacked color/line canvases with optional
// guides, and the color palette. All behavior lives in useDrawingCanvas; this is
// purely presentation wired to its bindings.
export function DrawingCanvas({ dc, mode, shape = "square", guides }: Props) {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-muted/30">
      {/* Controls row */}
      <header className="z-10 flex shrink-0 items-center justify-between gap-3 border-b bg-background px-3 py-2 sm:px-4 sm:py-3">
        <ModeSwitcher current={mode} />

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Layer toggle */}
          <div className="flex items-center rounded-md bg-muted p-0.5">
            {(["line", "color"] as Layer[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => dc.setLayer(l)}
                aria-pressed={dc.layer === l}
                className={cn(
                  "rounded px-2 py-1 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
                  dc.layer === l
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {l === "line" ? "Line" : "Color"}
              </button>
            ))}
          </div>

          <Button variant="ghost" size="icon" aria-label="Clear" onClick={dc.clear}>
            <RotateCcw />
          </Button>

          <span className="h-6 w-px bg-border" />

          <SaveButton getCanvas={dc.composeLayers} mode={mode} />

          <SaveLineArtMenu mode={mode} getLineCanvas={dc.getLineCanvas} />

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
              shape === "circle" ? "rounded-full" : "rounded-lg"
            )}
            style={{ width: dc.side || undefined, height: dc.side || undefined }}
          >
            {/* Color layer (bottom) — the top canvas captures pointer events and
                routes strokes to the active layer. */}
            <canvas
              ref={dc.colorCanvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
            {/* Line-art layer (top) — always visually above the color layer. */}
            <canvas
              ref={dc.lineCanvasRef}
              className="absolute inset-0 h-full w-full touch-none"
              onPointerDown={dc.onPointerDown}
              onPointerMove={dc.onPointerMove}
              onPointerUp={dc.endStroke}
              onPointerLeave={dc.endStroke}
              onPointerCancel={dc.endStroke}
            />
            {guides && (
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                width={dc.size.w}
                height={dc.size.h}
              >
                {guides}
              </svg>
            )}
          </div>
        </main>

        {dc.layer === "color" && (
          <ColorPalette
            value={dc.color}
            onChange={dc.setColor}
            footer={
              <ProtectionMenu protect={dc.protect} onChange={dc.setProtect} />
            }
          />
        )}
      </div>
    </div>
  )
}
