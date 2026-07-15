import type { DrawingMode } from "@/lib/drawings"
import { TILE_GRID, type Size, type SymParams } from "@/lib/symmetry"

// Faint guide overlay above the canvas showing a mode's symmetry: mandala sector
// spokes, the tile grid, or the mirror axis. Free-form has none. Sized to the
// canvas and pointer-transparent so strokes fall through.
export function ModeGuides({
  mode,
  params,
  size,
}: {
  mode: DrawingMode
  params: SymParams
  size: Size
}) {
  if (size.w === 0) return null
  const lines = guideLines(mode, params, size)
  if (lines.length === 0) return null

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      width={size.w}
      height={size.h}
    >
      {lines.map((l, i) => (
        <line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          className="stroke-zinc-900/[0.06]"
          strokeWidth={1}
        />
      ))}
    </svg>
  )
}

type Line = { x1: number; y1: number; x2: number; y2: number }

function guideLines(mode: DrawingMode, params: SymParams, size: Size): Line[] {
  const { w, h } = size
  if (mode === "mirror") {
    return [{ x1: w / 2, y1: 0, x2: w / 2, y2: h }]
  }
  if (mode === "tiles") {
    const cw = w / TILE_GRID
    const ch = h / TILE_GRID
    const lines: Line[] = []
    for (let i = 1; i < TILE_GRID; i++) {
      lines.push({ x1: i * cw, y1: 0, x2: i * cw, y2: h })
      lines.push({ x1: 0, y1: i * ch, x2: w, y2: i * ch })
    }
    return lines
  }
  if (mode === "mandala") {
    const cx = w / 2
    const cy = h / 2
    const r = w / 2
    const lines: Line[] = []
    for (let i = 0; i < params.sectors; i++) {
      const angle = -Math.PI / 2 + (Math.PI * 2 * i) / params.sectors
      lines.push({
        x1: cx,
        y1: cy,
        x2: cx + r * Math.cos(angle),
        y2: cy + r * Math.sin(angle),
      })
    }
    return lines
  }
  return []
}
