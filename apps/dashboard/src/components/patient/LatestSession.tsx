import { Cloud, Star, Wind, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { SessionSummary, GameType, FlagStatus } from '@/types/api'

interface LatestSessionProps {
  sessions: SessionSummary[]
  patientId: string
}

const gameConfig: Record<GameType, { label: string; icon: React.ElementType; domain: string }> = {
  cloud_catch: { label: 'Cloud Catch', icon: Cloud, domain: 'Attention' },
  star_sequence: { label: 'Star Sequence', icon: Star, domain: 'Memory' },
  sky_balance: { label: 'Sky Balance', icon: Wind, domain: 'Motor' },
}

const metricDisplayNames: Record<string, string> = {
  attention_accuracy: 'Accuracy',
  reaction_time_mean: 'Reaction Time',
  reaction_time_cv: 'RT Variability',
  false_positive_rate: 'False Positive Rate',
  attention_decay: 'Sustained Attention',
  sequence_accuracy: 'Sequence Accuracy',
  max_sequence_length: 'Max Sequence',
  learning_rate: 'Learning Rate',
  motor_precision: 'Precision',
  motor_smoothness: 'Smoothness',
  completion_rate: 'Completion Rate',
  processing_speed: 'Processing Speed',
  sort_accuracy: 'Sort Accuracy',
  switch_cost: 'Switch Cost',
}

const formatMetricValue = (name: string, value: number): string => {
  if (name.includes('time') && !name.includes('cv')) {
    return `${String(Math.round(value))}ms`
  }
  if (name.includes('rate') || name.includes('accuracy') || name.includes('decay') || name.includes('smoothness') || name.includes('precision') || name.includes('completion')) {
    return `${String(Math.round(value * 100))}%`
  }
  if (name.includes('sequence_length')) {
    return String(Math.round(value))
  }
  return value.toFixed(2)
}

const getFlagSeverity = (percentile: number | undefined): FlagStatus | null => {
  if (percentile === undefined) return null
  if (percentile <= 5) return 'red'
  if (percentile <= 15) return 'amber'
  return null
}

const estimatePercentile = (name: string, value: number): number => {
  // Simple estimate for display purposes - real percentiles come from the metrics API
  if (name.includes('accuracy') || name.includes('decay') || name.includes('smoothness') || name.includes('precision') || name.includes('completion')) {
    return Math.round(value * 100 * 0.7)
  }
  if (name.includes('time_mean')) {
    return Math.max(5, Math.min(95, Math.round(100 - value / 10)))
  }
  return 50
}

function TrendIcon({ percentile }: { percentile: number }): React.JSX.Element {
  if (percentile >= 50) return <TrendingUp className="h-4 w-4 text-flag-green" />
  if (percentile >= 25) return <Minus className="h-4 w-4 text-text-secondary" />
  return <TrendingDown className="h-4 w-4 text-flag-amber" />
}

function PercentileBar({ value }: { value: number }): React.JSX.Element {
  const clampedVal = Math.max(0, Math.min(100, value))
  const barColor = clampedVal <= 5 ? 'bg-flag-red' : clampedVal <= 15 ? 'bg-flag-amber' : clampedVal <= 50 ? 'bg-brand-primary' : 'bg-flag-green'

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: `${String(clampedVal)}%` }}
        />
      </div>
      <span className="text-xs text-text-secondary">P{clampedVal}</span>
    </div>
  )
}

function MetricCard({ name, value }: { name: string; value: number }): React.JSX.Element {
  const percentile = estimatePercentile(name, value)
  const severity = getFlagSeverity(percentile)

  return (
    <div
      className={`rounded-lg border p-3 ${
        severity === 'red' ? 'border-flag-red/40 bg-red-50/50' :
        severity === 'amber' ? 'border-flag-amber/40 bg-amber-50/50' :
        'border-border'
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs text-text-secondary">
          {metricDisplayNames[name] ?? name.replace(/_/g, ' ')}
        </span>
        <TrendIcon percentile={percentile} />
      </div>
      <div className="mt-1 font-mono text-lg font-semibold text-text-primary">
        {formatMetricValue(name, value)}
      </div>
      <div className="mt-1.5">
        <PercentileBar value={percentile} />
      </div>
    </div>
  )
}

const formatDate = (iso: string): string => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatDuration = (ms: number): string => {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${String(minutes)}m ${String(seconds)}s`
}

export function LatestSession({ sessions }: LatestSessionProps): React.JSX.Element {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Cloud className="mb-3 h-10 w-10 text-text-secondary/40" />
        <p className="text-sm text-text-secondary">No game sessions recorded yet</p>
      </div>
    )
  }

  // Get the most recent session
  const latestSession = [...sessions].sort((a, b) => b.date.localeCompare(a.date))[0]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm text-text-secondary">
        <span>{formatDate(latestSession.date)}</span>
        <span>&middot;</span>
        <span>{formatDuration(latestSession.durationMs)}</span>
        <span>&middot;</span>
        <span>{latestSession.gamesPlayed} games</span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {latestSession.games.map((game) => {
          const config = gameConfig[game.gameType]
          if (!config) return null
          const Icon = config.icon

          // Pick top 3 metrics to display
          const metricEntries = Object.entries(game.metrics).slice(0, 3)
          const hasFlag = metricEntries.some(([name, val]) => {
            const p = estimatePercentile(name, val)
            return p <= 15
          })

          return (
            <Card
              key={game.gameType}
              className="p-4"
              borderColor={hasFlag ? 'amber' : undefined}
            >
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/10">
                  <Icon className="h-4 w-4 text-brand-primary" />
                </div>
                <h3 className="text-sm font-semibold text-text-primary">{config.domain}</h3>
                {hasFlag && (
                  <div className="ml-auto">
                    <Badge variant="amber">Flagged</Badge>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2">
                {metricEntries.map(([name, val]) => (
                  <MetricCard key={name} name={name} value={val} />
                ))}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
