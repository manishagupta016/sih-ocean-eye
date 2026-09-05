import { apiClient } from './client'
import type { Survey, SurveySummary } from './types'

export interface CreateSurveyPayload {
  name: string
  location_name?: string
  sonar_format?: string
  notes?: string
}

export async function listSurveys(): Promise<SurveySummary[]> {
  const { data } = await apiClient.get<SurveySummary[]>('/surveys')
  return data
}

export async function getSurvey(id: string): Promise<Survey> {
  const { data } = await apiClient.get<Survey>(`/surveys/${id}`)
  return data
}

export async function createSurvey(payload: CreateSurveyPayload): Promise<Survey> {
  const { data } = await apiClient.post<Survey>('/surveys', payload)
  return data
}

export async function deleteSurvey(id: string): Promise<void> {
  await apiClient.delete(`/surveys/${id}`)
}
