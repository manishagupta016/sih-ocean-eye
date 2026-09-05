import { apiClient } from './client'
import type { DetectionWithContext, RiskTier } from './types'

export interface DetectionFilters {
  survey_id?: string
  sonar_file_id?: string
  min_calibrated_confidence?: number
  risk_tier?: RiskTier
  class_label?: string
  is_artificial?: boolean
  has_geo_metadata?: boolean
}

export async function listDetections(filters: DetectionFilters = {}): Promise<DetectionWithContext[]> {
  const { data } = await apiClient.get<DetectionWithContext[]>('/detections', { params: filters })
  return data
}

export async function getDetection(id: string): Promise<DetectionWithContext> {
  const { data } = await apiClient.get<DetectionWithContext>(`/detections/${id}`)
  return data
}
