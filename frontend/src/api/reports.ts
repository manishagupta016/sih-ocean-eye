import { apiClient } from './client'
import type { ReportFormat, ReportRead } from './types'

export async function listReports(surveyId?: string): Promise<ReportRead[]> {
  const { data } = await apiClient.get<ReportRead[]>('/reports', {
    params: surveyId ? { survey_id: surveyId } : undefined,
  })
  return data
}

export async function generateReport(surveyId: string, format: ReportFormat): Promise<ReportRead> {
  const { data } = await apiClient.post<ReportRead>('/reports/generate', {
    survey_id: surveyId,
    format,
  })
  return data
}

export async function downloadReport(reportId: string, filename: string): Promise<void> {
  const response = await apiClient.get(`/reports/${reportId}/download`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
