import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Users, Activity, TabletSmartphone, CheckCircle2 } from 'lucide-react'
import { apiClient } from '@/services/api'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import type { AnalyticsData } from '@/types/api'

function useAnalytics() {
  return useQuery<AnalyticsData>({
    queryKey: ['admin', 'analytics'],
    queryFn: async () => {
      const { data } = await apiClient.get<AnalyticsData>('/admin/analytics')
      return data
    },
    staleTime: 60_000,
  })
}

const formatDuration = (ms: number): string => {
  const minutes = Math.round(ms / 60_000)
  return `${String(minutes)} min`
}

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-brand-primary">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          {value}
        </p>
        <p className="text-sm text-text-secondary">{label}</p>
      </div>
    </Card>
  )
}

export function Analytics(): React.JSX.Element {
  const { data, isLoading } = useAnalytics()

  if (isLoading) {
    return (
      <div>
        <Skeleton width="200px" height="32px" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} width="100%" height="88px" />
          ))}
        </div>
        <div className="mt-8">
          <Skeleton width="100%" height="300px" />
        </div>
      </div>
    )
  }

  if (!data) return <div />

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary">Usage Analytics</h1>

      {/* Stat cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Patients"
          value={data.totalPatients}
          icon={<Users className="h-6 w-6" />}
        />
        <StatCard
          label="Sessions"
          value={data.totalSessions}
          icon={<Activity className="h-6 w-6" />}
        />
        <StatCard
          label="Active Tablets"
          value={data.activeTablets}
          icon={<TabletSmartphone className="h-6 w-6" />}
        />
        <StatCard
          label="Completion Rate"
          value={`${String(Math.round(data.completionRate * 100))}%`}
          icon={<CheckCircle2 className="h-6 w-6" />}
        />
      </div>

      {/* Average play duration */}
      <Card className="mt-8 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Average Play Duration</h2>
          <span
            className="text-2xl font-bold text-brand-primary"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {formatDuration(data.avgPlayDurationMs)}
          </span>
        </div>
      </Card>

      {/* Sessions per day chart */}
      <Card className="mt-6 p-6">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">Sessions per Day</h2>
        {data.sessionsPerPeriod.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.sessionsPerPeriod}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: '#6B7280' }}
                tickFormatter={(val: string) => {
                  const d = new Date(val)
                  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6B7280' }}
                allowDecimals={false}
              />
              <Tooltip
                labelFormatter={(val: string) => {
                  const d = new Date(val)
                  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                }}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #E5E7EB',
                  fontSize: '13px',
                }}
              />
              <Bar
                dataKey="count"
                name="Sessions"
                fill="#3B82F6"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-12 text-center text-text-secondary">No session data available</p>
        )}
      </Card>
    </div>
  )
}
