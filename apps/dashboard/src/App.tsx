import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/auth-context'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminRoute } from '@/components/AdminRoute'
import { Layout } from '@/components/Layout'
import { Login } from '@/routes/Login'
import { Mfa } from '@/routes/Mfa'
import { Patients } from '@/routes/Patients'
import { PatientDetail } from '@/routes/PatientDetail'
import { Staff } from '@/routes/admin/Staff'
import { Tablets } from '@/routes/admin/Tablets'
import { Import } from '@/routes/admin/Import'
import { Analytics } from '@/routes/admin/Analytics'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})

export function App(): React.JSX.Element {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/mfa" element={<Mfa />} />

            {/* Protected routes */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/patients" replace />} />
              <Route path="/patients" element={<Patients />} />
              <Route path="/patients/:id" element={<PatientDetail />} />

              {/* Admin routes */}
              <Route
                path="/admin/staff"
                element={
                  <AdminRoute>
                    <Staff />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/tablets"
                element={
                  <AdminRoute>
                    <Tablets />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/import"
                element={
                  <AdminRoute>
                    <Import />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/analytics"
                element={
                  <AdminRoute>
                    <Analytics />
                  </AdminRoute>
                }
              />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}
