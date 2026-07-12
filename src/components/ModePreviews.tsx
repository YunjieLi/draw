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
  // A minimalist butterfly. Its left half is drawn once and mirrored across the
  // vertical centre (x=60) so the two wings are exactly symmetric — echoing what
  // Mirror mode does to every stroke.
  const half = (
    <>
      {/* Antenna */}
      <path d="M60,44 C53,34 47,31 43,31" {...strokeProps} />
      {/* Upper wing */}
      <path d="M60,52 C42,28 18,34 22,54 C25,68 46,64 60,58" {...strokeProps} />
      {/* Lower wing */}
      <path d="M60,62 C46,72 30,80 34,92 C37,102 54,94 60,80" {...strokeProps} />
    </>
  )
  return (
    <svg viewBox="0 0 120 120" className={className} role="img">
      {/* Body doubles as the mirror axis. */}
      <line
        x1="60"
        y1="44"
        x2="60"
        y2="82"
        fill="none"
        stroke="currentColor"
        strokeWidth={4}
        strokeLinecap="round"
      />
      {half}
      <g transform="translate(120,0) scale(-1,1)">{half}</g>
    </svg>
  )
}
