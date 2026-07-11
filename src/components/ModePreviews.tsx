type PreviewProps = { className?: string }

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

export function FreeFormPreview({ className }: PreviewProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img">
      <path d="M15,90 C30,40 50,95 65,55 S100,30 108,75" {...strokeProps} />
    </svg>
  )
}

export function MandalaPreview({ className }: PreviewProps) {
  const spokes = 8
  return (
    <svg viewBox="0 0 120 120" className={className} role="img">
      <g transform="translate(60,60)">
        {Array.from({ length: spokes }, (_, i) => (
          <g key={i} transform={`rotate(${(360 / spokes) * i})`}>
            <path d="M0,0 C10,-25 -10,-25 0,-48" {...strokeProps} />
          </g>
        ))}
      </g>
    </svg>
  )
}

export function TilesPreview({ className }: PreviewProps) {
  const cols = 3
  const rows = 3
  const size = 120 / cols
  const tiles = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * size
      const y = r * size
      tiles.push(
        <path
          key={`${r}-${c}`}
          d={`M${x + 6},${y + size - 6} q${size / 2 - 6},-${size} ${size - 12},0`}
          {...strokeProps}
        />
      )
    }
  }
  return (
    <svg viewBox="0 0 120 120" className={className} role="img">
      {tiles}
    </svg>
  )
}

export function MirrorPreview({ className }: PreviewProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img">
      <line
        x1="60"
        y1="8"
        x2="60"
        y2="112"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeDasharray="4 6"
        className="text-muted-foreground/60"
      />
      <path d="M60,90 C42,60 54,35 40,20" {...strokeProps} />
      <path d="M60,90 C78,60 66,35 80,20" {...strokeProps} />
    </svg>
  )
}
