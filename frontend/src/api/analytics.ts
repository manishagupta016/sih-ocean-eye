import { apiClient } from './client'
import type {
  CalibrationReport,
  CrossDomainReport,
  DashboardSummary,
  LatencyReport,
  ModelVersionRead,
  PerformanceMetrics,
} from './types'

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary>('/analytics/dashboard-summary')
  return data
}

export async function getPerformanceMetrics(): Promise<PerformanceMetrics> {
  const { data } = await apiClient.get<PerformanceMetrics>('/analytics/performance')
  return data
}

export async function getCalibrationReport(): Promise<CalibrationReport> {
  const { data } = await apiClient.get<CalibrationReport>('/analytics/calibration')
  return data
}

export async function getCrossDomainReport(): Promise<CrossDomainReport> {
  const { data } = await apiClient.get<CrossDomainReport>('/analytics/cross-domain')
  return data
}

export async function getLatencyReport(): Promise<LatencyReport> {
  const { data } = await apiClient.get<LatencyReport>('/analytics/latency')
  return data
}

export async function listModelVersions(): Promise<ModelVersionRead[]> {
  const { data } = await apiClient.get<ModelVersionRead[]>('/analytics/model-versions')
  return data
}
