import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/services/api'
import type { MetricsResponse } from '@/types/api'

export interface UseMetricsOptions {
  metricName?: string
  gameType?: string
  from?: string
  to?: string
}

export function useMetrics(
  patientId: string | undefined,
  options: UseMetricsOptions = {},
): ReturnType<typeof useQuery<MetricsResponse>> {
  return useQuery<MetricsResponse>({
    queryKey: ['metrics', patientId, options],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (options.metricName) params.set('metricName', options.metricName)
      if (options.gameType) params.set('gameType', options.gameType)
      if (options.from) params.set('from', options.from)
      if (options.to) params.set('to', options.to)

      const query = params.toString()
      const url = `/dashboard/patients/${patientId}/metrics${query ? `?${query}` : ''}`
      const { data } = await apiClient.get<MetricsResponse>(url)
      return data
    },
    enabled: !!patientId,
    staleTime: 60_000,
  })
}
