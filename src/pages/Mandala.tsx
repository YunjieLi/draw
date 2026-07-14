import { useRef, useState } from "react"

import { DrawingCanvas } from "@/components/DrawingCanvas"
import {
  useDrawingCanvas,
  type Point,
  type Size,
  type StampEnv,
} from "@/lib/useDrawingCanvas"

const SECTOR_CHOICES = [5, 6, 8]
const randomSectors = () =>
  SECTOR_CHOICES[Math.floor(Math.random() * SECTOR_CHOICES.length)]

export default function Mandala() {
  const [sectors, setSectors] = useState(randomSectors)
  // Read inside stampOn/seedPoints, which run outside React's render.
  const sectorsRef = useRef(sectors)
  sectorsRef.current = sectors

  // Draw one segment rotated into each sector (dihedral rotational symmetry).
  function stampOn(
    ctx: CanvasRenderingContext2D,
    a: Point,
    b: Point,
    env: StampEnv
  ) {
    const { w, h } = env.size
    const cx = w / 2
    const cy = h / 2
    ctx.strokeStyle = env.color
    ctx.lineWidth = env.strokeWidth

    const step = (Math.PI * 2) / sectorsRef.current
    for (let i = 0; i < sectorsRef.current; i++) {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(step * i)
      ctx.beginPath()
      ctx.moveTo(a.x - cx, a.y - cy)
      ctx.lineTo(b.x - cx, b.y - cy)
      ctx.stroke()
      ctx.restore()
    }
  }

  // A stroke lands rotated into each sector (matching stampOn's rotations).
  function seedPoints(p: Point, size: Size) {
    const cx = size.w / 2
    const cy = size.h / 2
    const rx = p.x - cx
    const ry = p.y - cy
    const step = (Math.PI * 2) / sectorsRef.current
    const pts: Point[] = []
    for (let i = 0; i < sectorsRef.current; i++) {
      const c = Math.cos(step * i)
      const s = Math.sin(step * i)
      pts.push({ x: cx + rx * c - ry * s, y: cy + rx * s + ry * c })
    }
    return pts
  }

  const dc = useDrawingCanvas({
    stampOn,
    seedPoints,
    onClear: () => setSectors(randomSectors()),
  })

  // Guide spokes marking each sector boundary.
  const guides: React.ReactNode[] = []
  if (dc.size.w > 0) {
    const cx = dc.size.w / 2
    const cy = dc.size.h / 2
    const r = dc.size.w / 2
    for (let i = 0; i < sectors; i++) {
      const angle = -Math.PI / 2 + (Math.PI * 2 * i) / sectors
      guides.push(
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={cx + r * Math.cos(angle)}
          y2={cy + r * Math.sin(angle)}
          className="stroke-zinc-900/[0.06]"
          strokeWidth={1}
        />
      )
    }
  }

  return <DrawingCanvas dc={dc} mode="mandala" shape="circle" guides={guides} />
}
