import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/services/api'
import type { FlagsResponse, Flag } from '@/types/api'

export function useFlags(
  patientId: string | undefined,
  includeDismissed = false,
): ReturnType<typeof useQuery<FlagsResponse>> {
  return useQuery<FlagsResponse>({
    queryKey: ['flags', patientId, { includeDismissed }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (includeDismissed) params.set('includeDismissed', 'true')

      const query = params.toString()
      const url = `/dashboard/patients/${patientId}/flags${query ? `?${query}` : ''}`
      const { data } = await apiClient.get<FlagsResponse>(url)
      return data
    },
    enabled: !!patientId,
    staleTime: 30_000,
  })
}

interface DismissFlagVars {
  flagId: string
  reason: string
  patientId: string
}

export function useDismissFlag(): ReturnType<typeof useMutation<{ success: boolean }, unknown, DismissFlagVars>> {
  const queryClient = useQueryClient()

  return useMutation<{ success: boolean }, unknown, DismissFlagVars>({
    mutationFn: async ({ flagId, reason }) => {
      const { data } = await apiClient.patch<{ success: boolean }>(
        `/dashboard/flags/${flagId}/dismiss`,
        { reason },
      )
      return data
    },
    onMutate: async ({ flagId, patientId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['flags', patientId] })

      // Snapshot previous data
      const previousFlags = queryClient.getQueryData<FlagsResponse>(['flags', patientId, { includeDismissed: false }])

      // Optimistically update: mark flag as dismissed
      if (previousFlags) {
        queryClient.setQueryData<FlagsResponse>(
          ['flags', patientId, { includeDismissed: false }],
          {
            flags: previousFlags.flags.map((f: Flag) =>
              f.id === flagId ? { ...f, isDismissed: true } : f,
            ),
          },
        )
      }

      return { previousFlags }
    },
    onError: (_err, { patientId }, context) => {
      // Rollback on error
      const ctx = context as { previousFlags?: FlagsResponse } | undefined
      if (ctx?.previousFlags) {
        queryClient.setQueryData(
          ['flags', patientId, { includeDismissed: false }],
          ctx.previousFlags,
        )
      }
    },
    onSettled: (_data, _err, { patientId }) => {
      // Refetch to sync with server
      void queryClient.invalidateQueries({ queryKey: ['flags', patientId] })
      void queryClient.invalidateQueries({ queryKey: ['patients'] })
    },
  })
}
