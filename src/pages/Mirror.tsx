import { DrawingCanvas } from "@/components/DrawingCanvas"
import {
  useDrawingCanvas,
  type Point,
  type Size,
  type StampEnv,
} from "@/lib/useDrawingCanvas"

// Draw one segment, plus its reflection across the vertical center axis.
function stampOn(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  env: StampEnv
) {
  const { w } = env.size
  ctx.strokeStyle = env.color
  ctx.lineWidth = env.strokeWidth

  // Original stroke.
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()

  // Reflection across the vertical center axis.
  ctx.beginPath()
  ctx.moveTo(w - a.x, a.y)
  ctx.lineTo(w - b.x, b.y)
  ctx.stroke()
}

// A stroke lands at the pointer and its mirror across the vertical axis.
const seedPoints = (p: Point, size: Size) => [p, { x: size.w - p.x, y: p.y }]

export default function Mirror() {
  const dc = useDrawingCanvas({ stampOn, seedPoints })
  return (
    <DrawingCanvas
      dc={dc}
      mode="mirror"
      guides={
        <line
          x1={dc.size.w / 2}
          y1={0}
          x2={dc.size.w / 2}
          y2={dc.size.h}
          className="stroke-zinc-900/[0.06]"
          strokeWidth={1}
        />
      }
    />
  )
}
