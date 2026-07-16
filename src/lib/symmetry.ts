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

// One place a segment lands under a symmetry: the whole segment, moved.
export type Replica = [from: Point, to: Point]

export type Symmetry = {
  // Every place the segment a→b lands under the mode's symmetry — the single
  // source of truth for where a stroke goes. stampOn draws exactly these, and
  // coloring seeds a region from each replica's start and bounds each replica's
  // own box. Both endpoints of a replica ride the same copy of the pattern, so
  // a segment stays intact even when it crosses into the next tile/sector.
  replicas: (a: Point, b: Point, size: Size) => Replica[]
  // Draw one segment a→b, replicated with the mode's symmetry, onto `ctx`.
  stampOn: (
    ctx: CanvasRenderingContext2D,
    a: Point,
    b: Point,
    env: StampEnv
  ) => void
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

// A symmetry is just where its strokes repeat to — stamping is drawing each.
function fromReplicas(
  wrap: boolean,
  replicas: Symmetry["replicas"]
): Symmetry {
  return {
    wrap,
    replicas,
    stampOn(ctx, a, b, env) {
      applyBrush(ctx, env)
      for (const [from, to] of replicas(a, b, env.size)) segment(ctx, from, to)
    },
  }
}

// No symmetry: a stroke is drawn once, at the pointer.
function freeForm(): Symmetry {
  return fromReplicas(false, (a, b) => [[a, b]])
}

// A stroke plus its reflection across the vertical center axis.
function mirror(): Symmetry {
  return fromReplicas(false, (a, b, size) => [
    [a, b],
    [
      { x: size.w - a.x, y: a.y },
      { x: size.w - b.x, y: b.y },
    ],
  ])
}

// Where a stroke anchored at `p` repeats to, as offsets from `p`: into every
// tile, at the same offset within each. `rings` adds that many rings of tiles
// beyond the grid on every side — off-canvas replicas whose brush pokes back
// over the border, which is how a stroke that spills off one edge reappears on
// the opposite one (see Symmetry.wrap).
function tileOffsets(p: Point, size: Size, rings = 0): Point[] {
  const G = TILE_GRID
  const cw = size.w / G
  const ch = size.h / G
  const baseCol = Math.floor(p.x / cw)
  const baseRow = Math.floor(p.y / ch)
  const offsets: Point[] = []
  for (let row = -rings; row < G + rings; row++)
    for (let col = -rings; col < G + rings; col++)
      offsets.push({ x: (col - baseCol) * cw, y: (row - baseRow) * ch })
  return offsets
}

// A stroke replicated into every tile of the grid, at the same offset within
// each — so the pattern stays seamless.
function tiles(): Symmetry {
  // Both endpoints ride the tile `a` is in, so a segment crossing into the next
  // tile stays one segment. The extra ring only marks the canvas where a stroke
  // sits within a brush radius of a tile border; elsewhere those replicas fall
  // wholly outside it.
  return fromReplicas(true, (a, b, size) =>
    tileOffsets(a, size, 1).map((d): Replica => [
      { x: a.x + d.x, y: a.y + d.y },
      { x: b.x + d.x, y: b.y + d.y },
    ])
  )
}

// A stroke rotated into each sector (rotational symmetry).
function mandala(sectors: number): Symmetry {
  return fromReplicas(false, (a, b, size) => {
    const cx = size.w / 2
    const cy = size.h / 2
    const step = (Math.PI * 2) / sectors
    const out: Replica[] = []
    for (let i = 0; i < sectors; i++) {
      const c = Math.cos(step * i)
      const s = Math.sin(step * i)
      const rotate = (p: Point): Point => {
        const rx = p.x - cx
        const ry = p.y - cy
        return { x: cx + rx * c - ry * s, y: cy + rx * s + ry * c }
      }
      out.push([rotate(a), rotate(b)])
    }
    return out
  })
}
