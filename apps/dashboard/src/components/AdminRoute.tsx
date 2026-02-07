import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'

export function AdminRoute({ children }: { children: React.JSX.Element }): React.JSX.Element {
  const { user } = useAuth()

  if (user?.role !== 'admin') {
    return <Navigate to="/patients" replace />
  }

  return children
}
