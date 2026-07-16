import type { DrawingMode } from "./drawings"

export type Point = { x: number; y: number }
export type Size = { w: number; h: number }

// Live brush state handed to a symmetry's stampOn.
export type StampEnv = { color: string; strokeWidth: number; size: Size }

// Symmetry settings stored alongside a template so coloring replicates strokes
// the same way the lines were drawn. Only mandala reads `sectors` today; other
// modes ignore it.
export type SymParams = { sectors: number }

export const DEFAULT_SECTORS = 6
export const TILE_GRID = 4

// Line-drawing brush widths (device-independent px) offered in the creator.
export const STROKE_WIDTHS = [3, 5] as const
export const DEFAULT_STROKE_WIDTH = 5

export const defaultParams = (): SymParams => ({ sectors: DEFAULT_SECTORS })

export type Symmetry = {
  // Draw one segment a→b, replicated with the mode's symmetry, onto `ctx`.
  stampOn: (
    ctx: CanvasRenderingContext2D,
    a: Point,
    b: Point,
    env: StampEnv
  ) => void
  // Every place a point lands under that symmetry (used to seed coloring's
  // boundary protection so each replica stays in the region it starts in).
  seedPoints: (p: Point, size: Size) => Point[]
  // Whether the canvas is a torus — its opposite edges are the same seam. True
  // only for tiles, whose pattern keeps repeating past the border: a region
  // straddling that border is a single region showing as two halves at opposite
  // edges, so coloring has to flood (and paint) across the seam.
  wrap: boolean
}

// Build the symmetry for a mode + its params. Rebuilt cheaply per render.
export function getSymmetry(mode: DrawingMode, params: SymParams): Symmetry {
  switch (mode) {
    case "mandala":
      return mandala(params.sectors)
    case "tiles":
      return tiles()
    case "mirror":
      return mirror()
    case "free-form":
    default:
      return freeForm()
  }
}

function segment(ctx: CanvasRenderingContext2D, a: Point, b: Point) {
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
}

function applyBrush(ctx: CanvasRenderingContext2D, env: StampEnv) {
  ctx.strokeStyle = env.color
  ctx.lineWidth = env.strokeWidth
}

// No symmetry: a stroke is drawn once, at the pointer.
function freeForm(): Symmetry {
  return {
    wrap: false,
    stampOn(ctx, a, b, env) {
      applyBrush(ctx, env)
      segment(ctx, a, b)
    },
    seedPoints: (p) => [p],
  }
}

// A stroke plus its reflection across the vertical center axis.
function mirror(): Symmetry {
  return {
    wrap: false,
    stampOn(ctx, a, b, env) {
      const { w } = env.size
      applyBrush(ctx, env)
      segment(ctx, a, b)
      segment(ctx, { x: w - a.x, y: a.y }, { x: w - b.x, y: b.y })
    },
    seedPoints: (p, size) => [p, { x: size.w - p.x, y: p.y }],
  }
}

// Where a stroke anchored at `p` repeats to, as offsets from `p`: into every
// tile at the same offset within each, plus one ring of tiles past each edge.
// The extra ring is what keeps the pattern seamless — a stroke near a tile
// border spills over it, and off-canvas rings are how that spill comes back in
// at the opposite border rather than being clipped away.
function tileOffsets(p: Point, size: Size): Point[] {
  const G = TILE_GRID
  const cw = size.w / G
  const ch = size.h / G
  const baseCol = Math.floor(p.x / cw)
  const baseRow = Math.floor(p.y / ch)
  const offsets: Point[] = []
  for (let row = -1; row <= G; row++)
    for (let col = -1; col <= G; col++)
      offsets.push({ x: (col - baseCol) * cw, y: (row - baseRow) * ch })
  return offsets
}

// A stroke replicated into every tile of the grid, at the same offset within
// each — so the pattern stays seamless.
function tiles(): Symmetry {
  return {
    wrap: true,
    stampOn(ctx, a, b, env) {
      applyBrush(ctx, env)
      for (const d of tileOffsets(a, env.size))
        segment(
          ctx,
          { x: a.x + d.x, y: a.y + d.y },
          { x: b.x + d.x, y: b.y + d.y }
        )
    },
    seedPoints: (p, size) =>
      tileOffsets(p, size).map((d) => ({ x: p.x + d.x, y: p.y + d.y })),
  }
}

// A stroke rotated into each sector (rotational symmetry).
function mandala(sectors: number): Symmetry {
  return {
    wrap: false,
    stampOn(ctx, a, b, env) {
      const { w, h } = env.size
      const cx = w / 2
      const cy = h / 2
      applyBrush(ctx, env)
      const step = (Math.PI * 2) / sectors
      for (let i = 0; i < sectors; i++) {
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(step * i)
        segment(ctx, { x: a.x - cx, y: a.y - cy }, { x: b.x - cx, y: b.y - cy })
        ctx.restore()
      }
    },
    seedPoints(p, size) {
      const cx = size.w / 2
      const cy = size.h / 2
      const rx = p.x - cx
      const ry = p.y - cy
      const step = (Math.PI * 2) / sectors
      const pts: Point[] = []
      for (let i = 0; i < sectors; i++) {
        const c = Math.cos(step * i)
        const s = Math.sin(step * i)
        pts.push({ x: cx + rx * c - ry * s, y: cy + rx * s + ry * c })
      }
      return pts
    },
  }
}
