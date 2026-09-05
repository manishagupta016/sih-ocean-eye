import { apiClient } from './client'
import type { AlertSeverity, AlertWithContext } from './types'

export interface AlertFilters {
  acknowledged?: boolean
  severity?: AlertSeverity
}

export async function listAlerts(filters: AlertFilters = {}): Promise<AlertWithContext[]> {
  const { data } = await apiClient.get<AlertWithContext[]>('/alerts', { params: filters })
  return data
}

export async function acknowledgeAlert(id: string): Promise<AlertWithContext> {
  const { data } = await apiClient.post<AlertWithContext>(`/alerts/${id}/acknowledge`)
  return data
}
