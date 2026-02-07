import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import type { ApiError } from '@/types/api'

type TokenGetter = () => string | null
type RefreshHandler = () => Promise<string | null>
type LogoutHandler = () => void

let getToken: TokenGetter = () => null
let refreshTokens: RefreshHandler = async () => null
let onLogout: LogoutHandler = () => {}

export const setTokenGetter = (fn: TokenGetter): void => {
  getToken = fn
}

export const setRefreshHandler = (fn: RefreshHandler): void => {
  refreshTokens = fn
}

export const setLogoutHandler = (fn: LogoutHandler): void => {
  onLogout = fn
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL as string | undefined ?? '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: attach bearer token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: unknown) => Promise.reject(error),
)

// Track whether a refresh is already in-flight to avoid concurrent refreshes
let isRefreshing = false
let refreshSubscribers: Array<(token: string) => void> = []

const subscribeToRefresh = (cb: (token: string) => void): void => {
  refreshSubscribers.push(cb)
}

const notifyRefreshSubscribers = (token: string): void => {
  refreshSubscribers.forEach((cb) => cb(token))
  refreshSubscribers = []
}

// Response interceptor: handle 401 with token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }

    // Only attempt refresh on 401 and if we haven't retried yet
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(parseApiError(error))
    }

    // Don't try to refresh if the failed request was itself a refresh or login
    const url = originalRequest.url ?? ''
    if (url.includes('/auth/refresh') || url.includes('/auth/login')) {
      return Promise.reject(parseApiError(error))
    }

    originalRequest._retry = true

    if (isRefreshing) {
      // Another refresh is in progress -- queue this request
      return new Promise<ReturnType<typeof apiClient.request>>((resolve) => {
        subscribeToRefresh((newToken: string) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          resolve(apiClient(originalRequest))
        })
      })
    }

    isRefreshing = true

    try {
      const newToken = await refreshTokens()
      if (!newToken) {
        throw new Error('Refresh returned null')
      }
      notifyRefreshSubscribers(newToken)
      originalRequest.headers.Authorization = `Bearer ${newToken}`
      return apiClient(originalRequest)
    } catch {
      refreshSubscribers = []
      onLogout()
      return Promise.reject(parseApiError(error))
    } finally {
      isRefreshing = false
    }
  },
)

/**
 * Parse an Axios error into a structured ApiError or re-throw unknown errors.
 */
const parseApiError = (error: AxiosError<ApiError>): ApiError => {
  if (error.response?.data?.error) {
    return error.response.data
  }

  return {
    error: {
      code: 'NETWORK_ERROR',
      message: error.message || 'An unexpected network error occurred',
    },
  }
}
