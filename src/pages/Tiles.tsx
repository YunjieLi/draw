import { DrawingCanvas } from "@/components/DrawingCanvas"
import {
  useDrawingCanvas,
  type Point,
  type Size,
  type StampEnv,
} from "@/lib/useDrawingCanvas"

// Fixed drawing parameters.
const GRID = 4

// Draw one segment replicated into every tile of the grid. Each tile repeats
// the stroke at the same offset within it, so the pattern stays seamless.
function stampOn(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  env: StampEnv
) {
  const { w, h } = env.size
  const cw = w / GRID
  const ch = h / GRID

  ctx.strokeStyle = env.color
  ctx.lineWidth = env.strokeWidth

  // Local coordinates within a single tile, taken from the base point.
  const baseCol = Math.floor(a.x / cw)
  const baseRow = Math.floor(a.y / ch)

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const dx = (col - baseCol) * cw
      const dy = (row - baseRow) * ch
      ctx.beginPath()
      ctx.moveTo(a.x + dx, a.y + dy)
      ctx.lineTo(b.x + dx, b.y + dy)
      ctx.stroke()
    }
  }
}

// A stroke lands at the same position within every tile (matching stampOn).
const seedPoints = (p: Point, size: Size) => {
  const cw = size.w / GRID
  const ch = size.h / GRID
  const baseCol = Math.floor(p.x / cw)
  const baseRow = Math.floor(p.y / ch)
  const pts: Point[] = []
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      pts.push({
        x: p.x + (col - baseCol) * cw,
        y: p.y + (row - baseRow) * ch,
      })
    }
  }
  return pts
}

export default function Tiles() {
  const dc = useDrawingCanvas({ stampOn, seedPoints })

  // Guide lines marking each tile boundary.
  const guides: React.ReactNode[] = []
  if (dc.size.w > 0) {
    const cw = dc.size.w / GRID
    const ch = dc.size.h / GRID
    for (let i = 1; i < GRID; i++) {
      guides.push(
        <line
          key={`v${i}`}
          x1={i * cw}
          y1={0}
          x2={i * cw}
          y2={dc.size.h}
          className="stroke-zinc-900/[0.06]"
          strokeWidth={1}
        />,
        <line
          key={`h${i}`}
          x1={0}
          y1={i * ch}
          x2={dc.size.w}
          y2={i * ch}
          className="stroke-zinc-900/[0.06]"
          strokeWidth={1}
        />
      )
    }
  }

  return <DrawingCanvas dc={dc} mode="tiles" guides={guides} />
}
