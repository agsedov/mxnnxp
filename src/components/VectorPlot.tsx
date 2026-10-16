import type { PlotVector } from './plotVectors'

const WIDTH = 248
const HEIGHT = 188
/** Space kept free around the origin for tip labels and axis arrowheads. */
const MARGIN = 26
const HEAD_LENGTH = 9
const HEAD_HALF_WIDTH = 4
const VECTOR_COLORS = ['#7aa2f7', '#9ece6a', '#e0af68', '#bb9af7', '#7dcfff', '#f7768e', '#ff9e64', '#73daca']

/** Draws the vectors as arrows from the origin of a scaled 2D plane. */
export function VectorPlot({ vectors }: { vectors: readonly PlotVector[] }) {
  const originX = WIDTH / 2
  const originY = HEIGHT / 2

  let maxAbs = 0
  for (const vector of vectors) {
    maxAbs = Math.max(maxAbs, Math.abs(vector.x), Math.abs(vector.y))
  }
  // A finite, positive world extent and scale: an all-zero set (or one beyond
  // float range) still draws, collapsed at the origin.
  const extent = Number.isFinite(maxAbs) && maxAbs > 0 ? maxAbs : 1
  let scale = (Math.min(originX, originY) - MARGIN) / extent
  if (!Number.isFinite(scale) || scale <= 0) scale = 1

  const toX = (value: number) => originX + value * scale
  const toY = (value: number) => originY - value * scale
  const step = niceStep(extent / 2.5)
  const ticks = step > 0 ? tickValues(extent, step) : []

  return (
    <svg
      className="vector-plot"
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      aria-hidden="true"
    >
      {ticks.map(value => (
        <line key={`v${value}`} className="vector-plot-grid" x1={toX(value)} y1={0} x2={toX(value)} y2={HEIGHT} />
      ))}
      {ticks.map(value => (
        <line key={`h${value}`} className="vector-plot-grid" x1={0} y1={toY(value)} x2={WIDTH} y2={toY(value)} />
      ))}
      <line className="vector-plot-axis" x1={0} y1={originY} x2={WIDTH} y2={originY} />
      <line className="vector-plot-axis" x1={originX} y1={0} x2={originX} y2={HEIGHT} />
      <polygon
        className="vector-plot-axis"
        points={`${WIDTH},${originY} ${WIDTH - 8},${originY - 4} ${WIDTH - 8},${originY + 4}`}
      />
      <polygon className="vector-plot-axis" points={`${originX},0 ${originX - 4},8 ${originX + 4},8`} />
      {ticks.map(value => (
        <text key={`tx${value}`} className="vector-plot-tick" x={toX(value)} y={originY + 11} textAnchor="middle">
          {formatTick(value)}
        </text>
      ))}
      {ticks.map(value => (
        <text key={`ty${value}`} className="vector-plot-tick" x={originX - 5} y={toY(value) + 3} textAnchor="end">
          {formatTick(value)}
        </text>
      ))}
      <circle className="vector-plot-origin" cx={originX} cy={originY} r={2.5} />
      {vectors.map((vector, index) => (
        <PlotArrow
          key={index}
          vector={vector}
          color={VECTOR_COLORS[index % VECTOR_COLORS.length]}
          originX={originX}
          originY={originY}
          toX={toX}
          toY={toY}
        />
      ))}
    </svg>
  )
}

function PlotArrow({
  vector,
  color,
  originX,
  originY,
  toX,
  toY,
}: {
  vector: PlotVector
  color: string
  originX: number
  originY: number
  toX: (value: number) => number
  toY: (value: number) => number
}) {
  const tipX = toX(vector.x)
  const tipY = toY(vector.y)
  const dx = tipX - originX
  const dy = tipY - originY
  const length = Math.hypot(dx, dy)
  const label = `(${vector.components[0].toString()}, ${vector.components[1].toString()})`
  const labelX = tipX + (vector.x >= 0 ? 6 : -6)
  const labelY = tipY + (vector.y >= 0 ? -6 : 12)
  const anchor = vector.x >= 0 ? 'start' : 'end'

  if (length < 1) {
    // A (near-)zero vector has no direction: mark the origin instead.
    return (
      <g>
        <circle cx={originX} cy={originY} r={3.5} fill={color} />
        <text className="vector-plot-label" x={labelX} y={labelY} textAnchor={anchor} fill={color}>
          {label}
        </text>
      </g>
    )
  }

  const ux = dx / length
  const uy = dy / length
  const baseX = tipX - ux * HEAD_LENGTH
  const baseY = tipY - uy * HEAD_LENGTH
  const perpX = -uy * HEAD_HALF_WIDTH
  const perpY = ux * HEAD_HALF_WIDTH

  return (
    <g>
      <line className="vector-plot-shaft" x1={originX} y1={originY} x2={tipX} y2={tipY} stroke={color} />
      <polygon
        className="vector-plot-head"
        points={`${tipX},${tipY} ${baseX + perpX},${baseY + perpY} ${baseX - perpX},${baseY - perpY}`}
        fill={color}
      />
      <text className="vector-plot-label" x={labelX} y={labelY} textAnchor={anchor} fill={color}>
        {label}
      </text>
    </g>
  )
}

/** A 1/2/5×10^k step near `raw`, or 0 when no useful step exists. */
function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 0
  const exponent = Math.floor(Math.log10(raw))
  const magnitude = 10 ** exponent
  if (!Number.isFinite(magnitude) || magnitude <= 0) return 0
  const fraction = raw / magnitude
  const nice = fraction < 1.5 ? 1 : fraction < 3.5 ? 2 : fraction < 7.5 ? 5 : 10
  const step = nice * magnitude
  return Number.isFinite(step) && step > 0 ? step : 0
}

function tickValues(extent: number, step: number): number[] {
  const count = Math.min(Math.ceil(extent / step), 20)
  const values: number[] = []
  for (let k = -count; k <= count; k++) {
    if (k !== 0) values.push(Number((k * step).toPrecision(12)))
  }
  return values
}

function formatTick(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e-4 && abs < 1e5) return String(Number(value.toPrecision(6)))
  return value.toExponential(1)
}
