import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TabletSmartphone, Plus, Copy, Check } from 'lucide-react'
import { apiClient } from '@/services/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Tablet, TabletRegistration } from '@/types/api'

interface TabletListResponse {
  tablets: Tablet[]
}

function useTablets() {
  return useQuery<TabletListResponse>({
    queryKey: ['admin', 'tablets'],
    queryFn: async () => {
      const { data } = await apiClient.get<TabletListResponse>('/admin/tablets')
      return data
    },
    staleTime: 30_000,
  })
}

const formatDate = (iso: string | null): string => {
  if (!iso) return 'Never'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function Tablets(): React.JSX.Element {
  const { data, isLoading } = useTablets()
  const queryClient = useQueryClient()

  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [deviceName, setDeviceName] = useState('')
  const [registration, setRegistration] = useState<TabletRegistration | null>(null)
  const [copied, setCopied] = useState(false)

  const registerMutation = useMutation<TabletRegistration>({
    mutationFn: async () => {
      const { data } = await apiClient.post<TabletRegistration>('/admin/tablets', { deviceName: deviceName.trim() })
      return data
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tablets'] })
      setRegistration(result)
    },
  })

  const closeModal = () => {
    setShowRegisterModal(false)
    setDeviceName('')
    setRegistration(null)
    setCopied(false)
  }

  const handleRegister = () => {
    if (!deviceName.trim()) return
    registerMutation.mutate()
  }

  const copyToken = async (token: string) => {
    await navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <Skeleton width="200px" height="32px" />
          <Skeleton width="150px" height="36px" />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} width="100%" height="140px" />
          ))}
        </div>
      </div>
    )
  }

  const tablets = data?.tablets ?? []

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Tablets</h1>
        <Button onClick={() => setShowRegisterModal(true)}>
          <Plus className="h-4 w-4" />
          Register Tablet
        </Button>
      </div>

      {tablets.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center text-center">
          <TabletSmartphone className="mb-3 h-10 w-10 text-text-secondary" />
          <p className="text-lg font-medium text-text-primary">No tablets registered</p>
          <p className="mt-1 text-sm text-text-secondary">Register a tablet to get started</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tablets.map((t) => (
            <div
              key={t.id}
              className="rounded-lg border border-border bg-bg-card p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                    <TabletSmartphone className="h-5 w-5 text-brand-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">{t.deviceName ?? 'Unnamed'}</p>
                    <p className="text-xs text-text-secondary">{t.model ?? 'Unknown model'}</p>
                  </div>
                </div>
                <Badge variant={t.isActive ? 'green' : 'amber'}>
                  {t.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="mt-4 space-y-1 text-xs text-text-secondary">
                <p>Last seen: {formatDate(t.lastSeenAt)}</p>
                <p>Registered: {formatDate(t.registeredAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Register Modal */}
      <Modal
        isOpen={showRegisterModal}
        onClose={closeModal}
        title={registration ? 'Tablet Registered' : 'Register New Tablet'}
        footer={
          registration ? (
            <Button onClick={closeModal}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={closeModal}>Cancel</Button>
              <Button onClick={handleRegister} loading={registerMutation.isPending} disabled={!deviceName.trim()}>
                Register
              </Button>
            </>
          )
        }
      >
        {registration ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              Tablet registered successfully. Save the device token below — it will not be shown again.
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">Device Token</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded-lg border border-border bg-gray-50 px-3 py-2 text-xs font-mono text-text-primary">
                  {registration.deviceToken}
                </code>
                <button
                  onClick={() => void copyToken(registration.deviceToken)}
                  className="rounded-lg border border-border p-2 text-text-secondary transition-colors hover:bg-gray-50"
                  title="Copy token"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {registration.pairingQrCode && (
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">Pairing QR Code</label>
                <div className="flex items-center justify-center rounded-lg border border-border bg-white p-4">
                  <img src={registration.pairingQrCode} alt="Pairing QR Code" className="h-40 w-40" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              id="device-name"
              label="Device Name"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder='e.g., "Waiting Room iPad 1"'
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
