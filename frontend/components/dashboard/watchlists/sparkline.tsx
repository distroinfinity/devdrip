import type { SparklinePoint } from "@distrotv/shared"

interface Props {
  points: SparklinePoint[]
  width?: number
  height?: number
}

export function Sparkline({ points, width = 56, height = 18 }: Props) {
  if (points.length < 2) {
    return (
      <svg width={width} height={height}>
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--ink-faint)"
          strokeWidth={1}
        />
      </svg>
    )
  }
  const prices = points.map((p) => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const stepX = width / (prices.length - 1)
  const path = prices
    .map((p, i) => {
      const x = i * stepX
      const y = height - ((p - min) / range) * height
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
  const trendUp = prices[prices.length - 1] >= prices[0]
  const stroke = trendUp ? "#2F8F4E" : "#C13438"
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.4} />
    </svg>
  )
}
