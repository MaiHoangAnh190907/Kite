import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { apiClient } from '@/services/api'
import type { PatientsResponse } from '@/types/api'

export interface UsePatientsOptions {
  page?: number
  limit?: number
  search?: string
  status?: 'all' | 'flagged' | 'red'
  sort?: string
  order?: 'asc' | 'desc'
}

export function usePatients(options: UsePatientsOptions = {}): ReturnType<typeof useQuery<PatientsResponse>> {
  const { page = 1, limit = 50, search = '', status = 'all', sort = 'lastVisit', order = 'desc' } = options

  return useQuery<PatientsResponse>({
    queryKey: ['patients', { page, limit, search, status, sort, order }],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (search) params.set('search', search)
      if (status !== 'all') params.set('status', status)
      params.set('sort', sort)
      params.set('order', order)

      const { data } = await apiClient.get<PatientsResponse>(`/dashboard/patients?${params.toString()}`)
      return data
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  })
}
