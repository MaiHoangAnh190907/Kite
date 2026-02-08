import { useState, useMemo } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'
import { useFlags, useDismissFlag } from '@/hooks/use-flags'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Flag, GameType } from '@/types/api'

interface FlagsViewProps {
  patientId: string
}

const gameLabels: Record<GameType, string> = {
  cloud_catch: 'Cloud Catch',
  star_sequence: 'Star Sequence',
  sky_balance: 'Sky Balance',
}

const metricDisplayNames: Record<string, string> = {
  attention_accuracy: 'Attention Accuracy',
  reaction_time_mean: 'Mean Reaction Time',
  reaction_time_cv: 'Reaction Time Variability',
  false_positive_rate: 'False Positive Rate',
  attention_decay: 'Sustained Attention',
  sequence_accuracy: 'Sequence Accuracy',
  max_sequence_length: 'Max Sequence Length',
  motor_precision: 'Motor Precision',
  motor_smoothness: 'Motor Smoothness',
  processing_speed: 'Processing Speed',
  sort_accuracy: 'Sort Accuracy',
  switch_cost: 'Switch Cost',
}

const formatDate = (iso: string): string => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function FlagCard({
  flag,
  onDismiss,
}: {
  flag: Flag
  onDismiss?: (flag: Flag) => void
}): React.JSX.Element {
  return (
    <Card
      className={`p-4 ${flag.isDismissed ? 'opacity-60' : ''}`}
      borderColor={flag.isDismissed ? undefined : flag.severity === 'red' ? 'red' : 'amber'}
    >
      <div className="flex items-start gap-3">
        <Badge variant={flag.severity}>
          {flag.severity === 'red' ? 'Review recommended' : 'Pattern noted'}
        </Badge>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
            {metricDisplayNames[flag.metricName] ?? flag.metricName}
            <span className="text-xs font-normal text-text-secondary">
              &middot; {gameLabels[flag.gameType]}
            </span>
          </div>

          <p className="mt-1 text-sm text-text-secondary">{flag.description}</p>

          <div className="mt-2 flex items-center gap-3 text-xs text-text-secondary">
            <span>{formatDate(flag.createdAt)}</span>
            {flag.actualPercentile != null && (
              <span>P{flag.actualPercentile}</span>
            )}
          </div>

          {flag.isDismissed && flag.dismissedAt && (
            <div className="mt-2 rounded bg-gray-50 p-2 text-xs text-text-secondary">
              Dismissed {formatDate(flag.dismissedAt)}
              {flag.dismissReason && <span> &mdash; {flag.dismissReason}</span>}
            </div>
          )}
        </div>

        {!flag.isDismissed && onDismiss && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onDismiss(flag)}
          >
            Dismiss
          </Button>
        )}
      </div>
    </Card>
  )
}

export function FlagsView({ patientId }: FlagsViewProps): React.JSX.Element {
  const { data, isLoading } = useFlags(patientId, true)
  const dismissMutation = useDismissFlag()

  const [dismissTarget, setDismissTarget] = useState<Flag | null>(null)
  const [dismissNote, setDismissNote] = useState('')
  const [showDismissed, setShowDismissed] = useState(false)

  const { activeFlags, dismissedFlags } = useMemo(() => {
    if (!data) return { activeFlags: [], dismissedFlags: [] }

    const active = data.flags
      .filter((f) => !f.isDismissed)
      .sort((a, b) => {
        // Red first, then by date (newest first)
        if (a.severity !== b.severity) {
          return a.severity === 'red' ? -1 : 1
        }
        return b.createdAt.localeCompare(a.createdAt)
      })

    const dismissed = data.flags.filter((f) => f.isDismissed)

    return { activeFlags: active, dismissedFlags: dismissed }
  }, [data])

  const handleDismiss = (): void => {
    if (!dismissTarget) return

    dismissMutation.mutate(
      { flagId: dismissTarget.id, reason: dismissNote, patientId },
      {
        onSuccess: () => {
          setDismissTarget(null)
          setDismissNote('')
        },
      },
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i} className="p-4">
            <div className="flex gap-3">
              <Skeleton width="120px" height="24px" />
              <div className="flex-1 space-y-2">
                <Skeleton width="200px" height="16px" />
                <Skeleton width="100%" height="14px" />
                <Skeleton width="80px" height="12px" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  if (activeFlags.length === 0 && dismissedFlags.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle2 className="mb-3 h-10 w-10 text-flag-green" />
        <p className="text-lg font-medium text-text-primary">No concerns flagged</p>
        <p className="mt-1 text-sm text-text-secondary">
          All developmental patterns are within expected ranges
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Active Flags */}
      {activeFlags.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
            Active Flags ({activeFlags.length})
          </h3>
          {activeFlags.map((flag) => (
            <FlagCard
              key={flag.id}
              flag={flag}
              onDismiss={() => setDismissTarget(flag)}
            />
          ))}
        </div>
      )}

      {activeFlags.length === 0 && dismissedFlags.length > 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CheckCircle2 className="mb-3 h-10 w-10 text-flag-green" />
          <p className="text-sm text-text-secondary">All flags have been reviewed</p>
        </div>
      )}

      {/* Dismissed Flags */}
      {dismissedFlags.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowDismissed(!showDismissed)}
            className="flex items-center gap-1 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            {showDismissed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Show dismissed flags ({dismissedFlags.length})
          </button>

          {showDismissed && (
            <div className="mt-3 space-y-3">
              {dismissedFlags.map((flag) => (
                <FlagCard key={flag.id} flag={flag} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dismiss Modal */}
      <Modal
        isOpen={dismissTarget !== null}
        onClose={() => {
          setDismissTarget(null)
          setDismissNote('')
        }}
        title="Dismiss Flag"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setDismissTarget(null)
                setDismissNote('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDismiss}
              loading={dismissMutation.isPending}
            >
              Dismiss Flag
            </Button>
          </>
        }
      >
        {dismissTarget && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-center gap-2">
                <Badge variant={dismissTarget.severity}>
                  {dismissTarget.severity}
                </Badge>
                <span className="text-sm font-medium text-text-primary">
                  {metricDisplayNames[dismissTarget.metricName] ?? dismissTarget.metricName}
                </span>
              </div>
              <p className="mt-1 text-sm text-text-secondary">{dismissTarget.description}</p>
            </div>

            <div>
              <label
                htmlFor="dismiss-note"
                className="mb-1 block text-sm font-medium text-text-primary"
              >
                Add a note (optional)
              </label>
              <textarea
                id="dismiss-note"
                value={dismissNote}
                onChange={(e) => setDismissNote(e.target.value)}
                placeholder="e.g., Reviewed with family, no concerns at this time"
                className="w-full rounded-lg border border-border p-3 text-sm text-text-primary placeholder:text-text-secondary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                rows={3}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
