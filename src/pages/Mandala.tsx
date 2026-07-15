import { DrawingCanvas } from "@/components/DrawingCanvas"
import { useDrawingCanvas } from "@/lib/useDrawingCanvas"

// Mandala coloring: strokes rotate into every sector of a round canvas.
export default function Mandala() {
  const dc = useDrawingCanvas({ mode: "mandala" })
  return <DrawingCanvas dc={dc} />
}
