import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@/types/api'
import { apiClient, setTokenGetter, setRefreshHandler, setLogoutHandler } from '@/services/api'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isMfaVerified: boolean
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  verifyMfa: (code: string) => Promise<void>
  logout: () => void
  refreshAccessToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate()

  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [tempToken, setTempToken] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isMfaVerified, setIsMfaVerified] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const logout = useCallback(() => {
    setUser(null)
    setAccessToken(null)
    setRefreshToken(null)
    setTempToken(null)
    setIsAuthenticated(false)
    setIsMfaVerified(false)
    navigate('/login')
  }, [navigate])

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (!refreshToken) {
      return null
    }

    try {
      // Use axios directly to avoid interceptor loops
      const response = await apiClient.post<{
        accessToken: string
        refreshToken: string
      }>('/auth/refresh', { refreshToken })

      const { accessToken: newAccess, refreshToken: newRefresh } = response.data
      setAccessToken(newAccess)
      setRefreshToken(newRefresh)
      return newAccess
    } catch {
      logout()
      return null
    }
  }, [refreshToken, logout])

  // Wire up apiClient handlers once on mount and when dependencies change
  useEffect(() => {
    setTokenGetter(() => accessToken)
  }, [accessToken])

  useEffect(() => {
    setRefreshHandler(refreshAccessToken)
  }, [refreshAccessToken])

  useEffect(() => {
    setLogoutHandler(logout)
  }, [logout])

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    setIsLoading(true)
    try {
      const response = await apiClient.post<{
        mfaRequired: boolean
        tempToken: string
      }>('/auth/login', { email, password })

      setTempToken(response.data.tempToken)
      setIsMfaVerified(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const verifyMfa = useCallback(async (code: string): Promise<void> => {
    if (!tempToken) {
      throw new Error('No temp token available. Please log in first.')
    }

    setIsLoading(true)
    try {
      const response = await apiClient.post<{
        accessToken: string
        refreshToken: string
        user: User
      }>('/auth/mfa/verify', {
        tempToken,
        totpCode: code,
      })

      const { accessToken: access, refreshToken: refresh, user: userData } = response.data
      setAccessToken(access)
      setRefreshToken(refresh)
      setUser(userData)
      setTempToken(null)
      setIsAuthenticated(true)
      setIsMfaVerified(true)
    } finally {
      setIsLoading(false)
    }
  }, [tempToken])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      refreshToken,
      isAuthenticated,
      isMfaVerified,
      isLoading,
      login,
      verifyMfa,
      logout,
      refreshAccessToken,
    }),
    [user, accessToken, refreshToken, isAuthenticated, isMfaVerified, isLoading, login, verifyMfa, logout, refreshAccessToken],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
