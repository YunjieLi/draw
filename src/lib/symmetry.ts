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
    stampOn(ctx, a, b, env) {
      const { w } = env.size
      applyBrush(ctx, env)
      segment(ctx, a, b)
      segment(ctx, { x: w - a.x, y: a.y }, { x: w - b.x, y: b.y })
    },
    seedPoints: (p, size) => [p, { x: size.w - p.x, y: p.y }],
  }
}

// A stroke replicated into every tile of the grid, at the same offset within
// each — so the pattern stays seamless.
function tiles(): Symmetry {
  const G = TILE_GRID
  return {
    stampOn(ctx, a, b, env) {
      const { w, h } = env.size
      const cw = w / G
      const ch = h / G
      applyBrush(ctx, env)
      const baseCol = Math.floor(a.x / cw)
      const baseRow = Math.floor(a.y / ch)
      for (let row = 0; row < G; row++) {
        for (let col = 0; col < G; col++) {
          const dx = (col - baseCol) * cw
          const dy = (row - baseRow) * ch
          segment(ctx, { x: a.x + dx, y: a.y + dy }, { x: b.x + dx, y: b.y + dy })
        }
      }
    },
    seedPoints(p, size) {
      const cw = size.w / G
      const ch = size.h / G
      const baseCol = Math.floor(p.x / cw)
      const baseRow = Math.floor(p.y / ch)
      const pts: Point[] = []
      for (let row = 0; row < G; row++)
        for (let col = 0; col < G; col++)
          pts.push({
            x: p.x + (col - baseCol) * cw,
            y: p.y + (row - baseRow) * ch,
          })
      return pts
    },
  }
}

// A stroke rotated into each sector (rotational symmetry).
function mandala(sectors: number): Symmetry {
  return {
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
