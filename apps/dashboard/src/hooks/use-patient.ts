import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/services/api'
import type { PatientDetailResponse } from '@/types/api'

export function usePatient(id: string | undefined): ReturnType<typeof useQuery<PatientDetailResponse>> {
  return useQuery<PatientDetailResponse>({
    queryKey: ['patient', id],
    queryFn: async () => {
      const { data } = await apiClient.get<PatientDetailResponse>(`/dashboard/patients/${id}`)
      return data
    },
    enabled: !!id,
    staleTime: 60_000,
  })
}
