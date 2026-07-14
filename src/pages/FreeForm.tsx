import { DrawingCanvas } from "@/components/DrawingCanvas"
import {
  useDrawingCanvas,
  type Point,
  type StampEnv,
} from "@/lib/useDrawingCanvas"

// Free-form has no symmetry: a stroke is drawn once, at the pointer.
function stampOn(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  env: StampEnv
) {
  ctx.strokeStyle = env.color
  ctx.lineWidth = env.strokeWidth
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
}

const seedPoints = (p: Point) => [p]

export default function FreeForm() {
  const dc = useDrawingCanvas({ stampOn, seedPoints })
  return <DrawingCanvas dc={dc} mode="free-form" />
}
