import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronLeft, ChevronRight, Users, UserPlus } from 'lucide-react'
import { usePatients } from '@/hooks/use-patients'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Table, type Column } from '@/components/ui/Table'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import type { PatientListItem, FlagStatus } from '@/types/api'

type StatusFilter = 'all' | 'flagged' | 'red'
type PatientStatus = 'New' | 'Existing'

interface PatientRow extends PatientListItem {
  patientStatus: PatientStatus
}

const statusLabel: Record<FlagStatus, string> = {
  green: 'No concerns',
  amber: 'Pattern noted',
  red: 'Review recommended',
}

const columns: Column<PatientRow>[] = [
  { key: 'firstName', label: 'Name', sortable: true },
  { key: 'ageMonths', label: 'Age', sortable: true },
  { key: 'totalSessions', label: 'Sessions', sortable: true },
  { key: 'lastVisit', label: 'Last Visit', sortable: true },
  { key: 'flagStatus', label: 'Flag Status', sortable: true },
  { key: 'patientStatus', label: 'Patient Status', sortable: true },
]

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

export function Patients(): React.JSX.Element {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<keyof PatientRow & string>('lastVisit')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  const debouncedSearch = useDebounce(search, 300)

  const { data, isLoading } = usePatients({
    page,
    limit: 50,
    search: debouncedSearch,
    status: statusFilter,
    sort: sortKey,
    order: sortOrder,
  })

  const patients = useMemo<PatientRow[]>(() => {
    if (!data) return []
    return data.patients.map((p) => ({
      ...p,
      patientStatus: p.totalSessions <= 1 ? 'New' as const : 'Existing' as const,
    }))
  }, [data])

  const todaysPatients = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return patients.filter((p) => p.lastVisit === today)
  }, [patients])

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1

  const handleSort = useCallback(
    (key: keyof PatientRow & string) => {
      if (key === sortKey) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortKey(key)
        setSortOrder('asc')
      }
      setPage(1)
    },
    [sortKey],
  )

  const handleRowClick = useCallback(
    (row: PatientRow) => {
      navigate(`/patients/${row.id}`)
    },
    [navigate],
  )

  const renderCell = useCallback(
    (key: keyof PatientRow & string, _value: PatientRow[keyof PatientRow], row: PatientRow): React.ReactNode => {
      switch (key) {
        case 'firstName':
          return (
            <span className="font-medium">
              {row.firstName} {row.lastName}
            </span>
          )
        case 'ageMonths':
          return <span>{row.ageDisplay}</span>
        case 'flagStatus':
          return (
            <Badge variant={row.flagStatus}>
              {statusLabel[row.flagStatus]}
            </Badge>
          )
        case 'patientStatus':
          return (
            <Badge variant={row.patientStatus === 'New' ? 'amber' : 'green'}>
              {row.patientStatus}
            </Badge>
          )
        default:
          return String(row[key] ?? '')
      }
    },
    [],
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Patients</h1>
        <Button variant="primary" size="sm" onClick={() => {}}>
          <UserPlus className="h-4 w-4" />
          Add Patient
        </Button>
      </div>

      {/* Today's Patients */}
      {!isLoading && todaysPatients.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-text-primary">Today's Patients</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {todaysPatients.map((p) => (
              <Card
                key={p.id}
                className="flex min-w-[200px] cursor-pointer items-center gap-3 p-4 transition-shadow hover:shadow-md"
                borderColor={p.flagStatus === 'red' ? 'red' : p.flagStatus === 'amber' ? 'amber' : undefined}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-3 text-left"
                  onClick={() => navigate(`/patients/${p.id}`)}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-sm font-semibold text-brand-primary">
                    {p.firstName[0]}{p.lastName[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-text-primary">
                      {p.firstName} {p.lastName}
                    </div>
                    <div className="text-xs text-text-secondary">{p.ageDisplay}</div>
                  </div>
                  <div className="ml-auto">
                    <Badge variant={p.flagStatus}>
                      {p.activeFlagCount > 0 ? String(p.activeFlagCount) : ''}
                    </Badge>
                  </div>
                </button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              placeholder="Search patients..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-lg border border-border bg-white py-2 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-secondary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>

          {/* Filter buttons */}
          <div className="flex gap-1">
            {([
              ['all', 'All'],
              ['flagged', 'Flagged'],
              ['red', 'Red Flags'],
            ] as [StatusFilter, string][]).map(([value, label]) => (
              <Button
                key={value}
                variant={statusFilter === value ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => {
                  setStatusFilter(value)
                  setPage(1)
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Patient Table */}
      <Card>
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton width="180px" height="20px" />
                <Skeleton width="80px" height="20px" />
                <Skeleton width="100px" height="20px" />
                <Skeleton width="60px" height="20px" />
                <Skeleton width="120px" height="20px" />
              </div>
            ))}
          </div>
        ) : data && patients.length > 0 ? (
          <>
            <Table<PatientRow>
              columns={columns}
              data={patients}
              sortKey={sortKey}
              sortOrder={sortOrder}
              onSort={handleSort}
              onRowClick={handleRowClick}
              renderCell={renderCell}
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <span className="text-sm text-text-secondary">
                  Showing {(page - 1) * (data.limit) + 1}–{Math.min(page * data.limit, data.total)} of {data.total}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <span className="text-sm text-text-secondary">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="mb-4 h-12 w-12 text-text-secondary/50" />
            <p className="text-lg font-medium text-text-primary">No patients found</p>
            <p className="mt-1 text-sm text-text-secondary">
              {search ? 'Try adjusting your search or filters' : 'No patients have been registered yet'}
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}
