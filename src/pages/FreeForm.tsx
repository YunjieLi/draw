import { DrawingCanvas } from "@/components/DrawingCanvas"
import { useDrawingCanvas } from "@/lib/useDrawingCanvas"

// Free-form coloring: no symmetry — paint once, at the pointer.
export default function FreeForm() {
  const dc = useDrawingCanvas({ mode: "free-form" })
  return <DrawingCanvas dc={dc} />
}
