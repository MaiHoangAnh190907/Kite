import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, KeyRound, UserX } from 'lucide-react'
import { apiClient } from '@/services/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import type { StaffMember, UserRole } from '@/types/api'

interface StaffListResponse {
  staff: StaffMember[]
}

function useStaff() {
  return useQuery<StaffListResponse>({
    queryKey: ['admin', 'staff'],
    queryFn: async () => {
      const { data } = await apiClient.get<StaffListResponse>('/admin/staff')
      return data
    },
    staleTime: 30_000,
  })
}

export function Staff(): React.JSX.Element {
  const { data, isLoading } = useStaff()
  const queryClient = useQueryClient()

  const [showAddModal, setShowAddModal] = useState(false)
  const [resetTarget, setResetTarget] = useState<StaffMember | null>(null)
  const [newPin, setNewPin] = useState('')

  // Add staff form state
  const [addName, setAddName] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState<UserRole>('staff')
  const [addPin, setAddPin] = useState('')
  const [addPassword, setAddPassword] = useState('')

  const addMutation = useMutation({
    mutationFn: async (body: { name: string; email?: string; role: UserRole; pin?: string; password?: string }) => {
      const { data } = await apiClient.post('/admin/staff', body)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] })
      closeAddModal()
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: async (staffId: string) => {
      const { data } = await apiClient.delete(`/admin/staff/${staffId}`)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] })
    },
  })

  const resetPinMutation = useMutation({
    mutationFn: async ({ staffId, newPin }: { staffId: string; newPin: string }) => {
      const { data } = await apiClient.patch(`/admin/staff/${staffId}/reset-pin`, { newPin })
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] })
      setResetTarget(null)
      setNewPin('')
    },
  })

  const closeAddModal = () => {
    setShowAddModal(false)
    setAddName('')
    setAddEmail('')
    setAddRole('staff')
    setAddPin('')
    setAddPassword('')
  }

  const handleAdd = () => {
    if (!addName.trim()) return
    addMutation.mutate({
      name: addName.trim(),
      email: addEmail.trim() || undefined,
      role: addRole,
      pin: addPin || undefined,
      password: addPassword || undefined,
    })
  }

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <Skeleton width="200px" height="32px" />
          <Skeleton width="120px" height="36px" />
        </div>
        <div className="mt-6 space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} width="100%" height="52px" />
          ))}
        </div>
      </div>
    )
  }

  const staff = data?.staff ?? []

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Staff Members</h1>
        <Button onClick={() => setShowAddModal(true)}>
          <UserPlus className="h-4 w-4" />
          Add Staff
        </Button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-bg-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">Name</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">Email</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">Role</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">Status</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">Added</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3 font-medium text-text-primary">{s.name}</td>
                <td className="px-4 py-3 text-text-secondary">{s.email ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium capitalize text-text-primary">
                    {s.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={s.isActive ? 'green' : 'amber'}>
                    {s.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-text-secondary">{s.createdAt}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {s.role === 'staff' && s.isActive && (
                      <button
                        onClick={() => setResetTarget(s)}
                        className="rounded p-1 text-text-secondary transition-colors hover:bg-gray-100 hover:text-text-primary"
                        title="Reset PIN"
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                    )}
                    {s.isActive && (
                      <button
                        onClick={() => deactivateMutation.mutate(s.id)}
                        className="rounded p-1 text-text-secondary transition-colors hover:bg-red-50 hover:text-flag-red"
                        title="Deactivate"
                      >
                        <UserX className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                  No staff members found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Staff Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={closeAddModal}
        title="Add Staff Member"
        footer={
          <>
            <Button variant="secondary" onClick={closeAddModal}>Cancel</Button>
            <Button onClick={handleAdd} loading={addMutation.isPending}>Add</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            id="add-name"
            label="Name"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="Full name"
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-role" className="text-sm font-medium text-text-primary">Role</label>
            <select
              id="add-role"
              value={addRole}
              onChange={(e) => setAddRole(e.target.value as UserRole)}
              className="rounded-lg border border-border px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            >
              <option value="staff">Staff</option>
              <option value="clinician">Clinician</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {(addRole === 'clinician' || addRole === 'admin') && (
            <>
              <Input
                id="add-email"
                label="Email"
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="email@clinic.com"
              />
              <Input
                id="add-password"
                label="Password"
                type="password"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                placeholder="Min 8 characters"
              />
            </>
          )}
          {addRole === 'staff' && (
            <Input
              id="add-pin"
              label="PIN"
              value={addPin}
              onChange={(e) => setAddPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="4-6 digit PIN"
              inputMode="numeric"
            />
          )}
        </div>
      </Modal>

      {/* Reset PIN Modal */}
      <Modal
        isOpen={resetTarget !== null}
        onClose={() => { setResetTarget(null); setNewPin('') }}
        title="Reset PIN"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setResetTarget(null); setNewPin('') }}>Cancel</Button>
            <Button
              onClick={() => resetTarget && resetPinMutation.mutate({ staffId: resetTarget.id, newPin })}
              loading={resetPinMutation.isPending}
              disabled={newPin.length < 4}
            >
              Reset
            </Button>
          </>
        }
      >
        {resetTarget && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Set a new PIN for <span className="font-medium text-text-primary">{resetTarget.name}</span>.
            </p>
            <Input
              id="new-pin"
              label="New PIN"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="4-6 digit PIN"
              inputMode="numeric"
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
