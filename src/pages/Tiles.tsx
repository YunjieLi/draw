import { DrawingCanvas } from "@/components/DrawingCanvas"
import { useDrawingCanvas } from "@/lib/useDrawingCanvas"

// Tiles coloring: strokes repeat seamlessly across a grid of tiles.
export default function Tiles() {
  const dc = useDrawingCanvas({ mode: "tiles" })
  return <DrawingCanvas dc={dc} />
}
