import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/toast'
import { LoadingState } from '@/components/common/StateViews'
import { AlertsPage } from '@/pages/AlertsPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { AuthPage } from '@/pages/AuthPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { IdentificationGuidePage } from '@/pages/IdentificationGuidePage'
import { LandingPage } from '@/pages/LandingPage'
import { MapPage } from '@/pages/MapPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { ResultsPage } from '@/pages/ResultsPage'
import { RiskListPage } from '@/pages/RiskListPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { UploadPage } from '@/pages/UploadPage'
import { ProtectedRoute } from '@/routes/ProtectedRoute'

// Lazy-loaded: pulls in the Plotly gl3d bundle, which would otherwise inflate every other page's
// initial load for a feature only this one route uses.
const ModelsPage = lazy(() => import('@/pages/ModelsPage').then((m) => ({ default: m.ModelsPage })))

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <UploadPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/results/:sonarFileId"
          element={
            <ProtectedRoute>
              <ResultsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/map"
          element={
            <ProtectedRoute>
              <MapPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/risk-list"
          element={
            <ProtectedRoute>
              <RiskListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/alerts"
          element={
            <ProtectedRoute>
              <AlertsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/identification-guide"
          element={
            <ProtectedRoute>
              <IdentificationGuidePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/3d"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingState label="Loading 3D models…" />}>
                <ModelsPage />
              </Suspense>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}
