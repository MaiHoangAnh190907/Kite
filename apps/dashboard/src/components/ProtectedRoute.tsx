import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'

export function ProtectedRoute({ children }: { children: React.JSX.Element }): React.JSX.Element {
  const { isAuthenticated, isMfaVerified } = useAuth()

  if (!isAuthenticated || !isMfaVerified) {
    return <Navigate to="/login" replace />
  }

  return children
}
