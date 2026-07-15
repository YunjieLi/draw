import { DrawingCanvas } from "@/components/DrawingCanvas"
import { useDrawingCanvas } from "@/lib/useDrawingCanvas"

// Mirror coloring: strokes reflect across the vertical center axis.
export default function Mirror() {
  const dc = useDrawingCanvas({ mode: "mirror" })
  return <DrawingCanvas dc={dc} />
}
