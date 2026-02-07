import { useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Calendar, Hash } from 'lucide-react'
import { usePatient } from '@/hooks/use-patient'
import { useFlags } from '@/hooks/use-flags'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { LatestSession } from '@/components/patient/LatestSession'
import { TrendsView } from '@/components/patient/TrendsView'
import { FlagsView } from '@/components/patient/FlagsView'

type TabKey = 'session' | 'trends' | 'flags'

const formatDate = (iso: string): string => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatAge = (months: number): string => {
  const years = Math.floor(months / 12)
  const remaining = months % 12
  return `${String(years)} yrs ${String(remaining)} mos`
}

export function PatientDetail(): React.JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab = (searchParams.get('tab') as TabKey) || 'session'

  const { data, isLoading } = usePatient(id)
  const { data: flagsData } = useFlags(id, true)

  const activeFlagCount = useMemo(() => {
    if (!flagsData) return 0
    return flagsData.flags.filter((f) => !f.isDismissed).length
  }, [flagsData])

  const setTab = (tab: TabKey): void => {
    setSearchParams({ tab })
  }

  const sessionDateRange = useMemo(() => {
    if (!data || data.sessions.length === 0) return null
    const sorted = [...data.sessions].sort((a, b) => a.date.localeCompare(b.date))
    return {
      first: formatDate(sorted[0].date),
      last: formatDate(sorted[sorted.length - 1].date),
    }
  }, [data])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton width="120px" height="20px" />
        <div className="space-y-2">
          <Skeleton width="250px" height="32px" />
          <Skeleton width="180px" height="20px" />
        </div>
        <div className="flex gap-4">
          <Skeleton width="140px" height="40px" />
          <Skeleton width="140px" height="40px" />
          <Skeleton width="140px" height="40px" />
        </div>
        <Skeleton width="100%" height="300px" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Button variant="secondary" size="sm" onClick={() => navigate('/patients')}>
          <ArrowLeft className="h-4 w-4" />
          Back to Patients
        </Button>
        <p className="text-text-secondary">Patient not found.</p>
      </div>
    )
  }

  const { patient, sessions } = data

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        type="button"
        onClick={() => navigate('/patients')}
        className="inline-flex items-center gap-1 text-sm text-text-secondary transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Patients
      </button>

      {/* Patient header */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {patient.firstName} {patient.lastName}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
              <span>{formatAge(patient.ageMonths)}</span>
              <span>DOB: {formatDate(patient.dateOfBirth)}</span>
              {patient.guardianName && <span>Guardian: {patient.guardianName}</span>}
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Hash className="h-4 w-4" />
              <span>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
            </div>
            {sessionDateRange && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Calendar className="h-4 w-4" />
                <span>{sessionDateRange.first} &ndash; {sessionDateRange.last}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-border">
        {([
          ['session', 'Latest Session'],
          ['trends', 'Trends'],
          ['flags', `Flags${activeFlagCount > 0 ? ` (${String(activeFlagCount)})` : ''}`],
        ] as [TabKey, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'session' && (
        <LatestSession sessions={sessions} patientId={patient.id} />
      )}
      {activeTab === 'trends' && (
        <TrendsView patientId={patient.id} />
      )}
      {activeTab === 'flags' && (
        <FlagsView patientId={patient.id} />
      )}

      {/* Print header (hidden on screen) */}
      <div className="print-only">
        <div className="mb-4 border-b pb-2">
          <h1 className="text-xl font-bold">Kite Clinical Report — {patient.firstName} {patient.lastName}</h1>
          <p className="text-sm text-gray-500">Generated: {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  )
}
