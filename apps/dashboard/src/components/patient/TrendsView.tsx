import { useMemo } from 'react'
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Area,
  ComposedChart,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react'
import { useMetrics } from '@/hooks/use-metrics'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import type { MetricSeries, TrendDirection, GameType } from '@/types/api'

interface TrendsViewProps {
  patientId: string
}

const domainConfig: Record<string, { label: string; games: GameType[]; metrics: string[] }> = {
  attention: {
    label: 'Attention',
    games: ['cloud_catch'],
    metrics: ['attention_accuracy', 'reaction_time_mean', 'reaction_time_cv'],
  },
  memory: {
    label: 'Memory',
    games: ['star_sequence'],
    metrics: ['sequence_accuracy', 'max_sequence_length'],
  },
  motor: {
    label: 'Motor',
    games: ['wind_trails'],
    metrics: ['motor_precision', 'motor_smoothness'],
  },
  processing: {
    label: 'Processing',
    games: ['sky_sort'],
    metrics: ['processing_speed', 'sort_accuracy', 'switch_cost'],
  },
}

const metricDisplayNames: Record<string, string> = {
  attention_accuracy: 'Attention Accuracy',
  reaction_time_mean: 'Mean Reaction Time',
  reaction_time_cv: 'Reaction Time Variability',
  sequence_accuracy: 'Sequence Accuracy',
  max_sequence_length: 'Max Sequence Length',
  motor_precision: 'Motor Precision',
  motor_smoothness: 'Motor Smoothness',
  processing_speed: 'Processing Speed',
  sort_accuracy: 'Sort Accuracy',
  switch_cost: 'Switch Cost',
}

function TrendIcon({ trend }: { trend: TrendDirection }): React.JSX.Element {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="h-4 w-4 text-flag-green" />
    case 'declining':
      return <TrendingDown className="h-4 w-4 text-flag-red" />
    default:
      return <Minus className="h-4 w-4 text-text-secondary" />
  }
}

const formatDateShort = (dateStr: string): string => {
  const d = new Date(dateStr)
  const month = d.toLocaleDateString('en-US', { month: 'short' })
  const year = String(d.getFullYear()).slice(2)
  return `${month} '${year}`
}

interface ChartDataPoint {
  date: string
  dateLabel: string
  value: number
  percentile: number | null
  ageMonths: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ payload: ChartDataPoint }>
  label?: string
}

function ChartTooltip({ active, payload }: CustomTooltipProps): React.JSX.Element | null {
  if (!active || !payload || payload.length === 0) return null

  const point = payload[0].payload

  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-text-primary">{point.date}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold text-brand-primary">
        {typeof point.value === 'number' ? point.value.toFixed(2) : point.value}
      </p>
      {point.percentile !== null && (
        <p className="text-xs text-text-secondary">Percentile: {point.percentile}th</p>
      )}
      <p className="text-xs text-text-secondary">
        Age: {Math.floor(point.ageMonths / 12)}y {point.ageMonths % 12}m
      </p>
    </div>
  )
}

function TrendChart({ series }: { series: MetricSeries }): React.JSX.Element {
  const chartData: ChartDataPoint[] = useMemo(() => {
    return series.dataPoints.map((dp) => ({
      date: dp.date,
      dateLabel: formatDateShort(dp.date),
      value: dp.value,
      percentile: dp.percentile,
      ageMonths: dp.ageMonths,
    }))
  }, [series.dataPoints])

  if (chartData.length < 2) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-text-secondary">
        Need more visits to show trends
      </div>
    )
  }

  // Calculate Y-axis domain with padding
  const values = chartData.map((d) => d.value)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const padding = (maxVal - minVal) * 0.2 || maxVal * 0.2
  const yMin = Math.max(0, minVal - padding)
  const yMax = maxVal + padding

  // Normative band boundaries (approximate)
  const normativeTop = yMax * 0.85
  const normativeBottom = yMax * 0.15
  const belowAmber = yMax * 0.15
  const belowRed = yMax * 0.05

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />

        {/* Normative band (15th-85th percentile) */}
        <ReferenceArea
          y1={normativeBottom}
          y2={normativeTop}
          fill="#10B981"
          fillOpacity={0.08}
          ifOverflow="hidden"
        />

        {/* Below 15th percentile zone */}
        <ReferenceArea
          y1={belowRed}
          y2={belowAmber}
          fill="#F59E0B"
          fillOpacity={0.08}
          ifOverflow="hidden"
        />

        {/* Below 5th percentile zone */}
        <ReferenceArea
          y1={yMin}
          y2={belowRed}
          fill="#EF4444"
          fillOpacity={0.08}
          ifOverflow="hidden"
        />

        <XAxis
          dataKey="dateLabel"
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickLine={false}
          axisLine={{ stroke: '#E5E7EB' }}
        />
        <YAxis
          domain={[yMin, yMax]}
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickLine={false}
          axisLine={{ stroke: '#E5E7EB' }}
          width={50}
        />
        <Tooltip content={<ChartTooltip />} />

        {/* Area fill under line */}
        <Area
          type="monotone"
          dataKey="value"
          fill="#3B82F6"
          fillOpacity={0.08}
          stroke="none"
        />

        {/* Data line */}
        <Line
          type="monotone"
          dataKey="value"
          stroke="#3B82F6"
          strokeWidth={2}
          dot={{ r: 5, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }}
          activeDot={{ r: 7, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function TrendsView({ patientId }: TrendsViewProps): React.JSX.Element {
  const { data, isLoading } = useMetrics(patientId)

  if (isLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 2 }, (_, i) => (
          <Card key={i} className="p-6">
            <Skeleton width="160px" height="24px" />
            <div className="mt-4">
              <Skeleton width="100%" height="220px" />
            </div>
          </Card>
        ))}
      </div>
    )
  }

  if (!data || data.metrics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <BarChart3 className="mb-3 h-10 w-10 text-text-secondary/40" />
        <p className="text-sm text-text-secondary">No trend data available yet</p>
      </div>
    )
  }

  // Group metrics by domain
  const domainMetrics = Object.entries(domainConfig).map(([key, config]) => {
    const series = data.metrics.filter(
      (m) => config.metrics.includes(m.metricName) || config.games.includes(m.gameType),
    )
    return { key, ...config, series }
  }).filter((d) => d.series.length > 0)

  return (
    <div className="space-y-6">
      {domainMetrics.map((domain) => (
        <Card key={domain.key} className="p-6">
          <h3 className="mb-4 text-lg font-semibold text-text-primary">{domain.label} Domain</h3>

          <div className="space-y-6">
            {domain.series.map((series) => (
              <div key={`${series.gameType}-${series.metricName}`}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">
                    {metricDisplayNames[series.metricName] ?? series.metricName}
                  </span>
                  {series.latestPercentile !== null && (
                    <span className="text-xs text-text-secondary">
                      P{series.latestPercentile}
                    </span>
                  )}
                  <TrendIcon trend={series.trend} />
                </div>
                <TrendChart series={series} />
              </div>
            ))}
          </div>
        </Card>
      ))}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-flag-green/20" /> 15th-85th percentile (normative)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-flag-amber/20" /> Below 15th percentile
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-flag-red/20" /> Below 5th percentile
        </span>
      </div>
    </div>
  )
}
