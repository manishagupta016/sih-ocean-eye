import { apiClient } from './client'
import type { JobStatus, SonarFile, UploadResponse } from './types'

export interface PreprocessPreview {
  before_png_base64: string
  after_png_base64: string
}

export async function previewPreprocessing(file: File): Promise<PreprocessPreview> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await apiClient.post<PreprocessPreview>('/uploads/preview', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function uploadSonarFile(
  surveyId: string,
  file: File,
  navLog?: File,
): Promise<UploadResponse> {
  const form = new FormData()
  form.append('survey_id', surveyId)
  form.append('file', file)
  if (navLog) form.append('nav_log', navLog)

  const { data } = await apiClient.post<UploadResponse>('/uploads', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const { data } = await apiClient.get<JobStatus>(`/uploads/jobs/${jobId}`)
  return data
}

export async function getSonarFile(sonarFileId: string): Promise<SonarFile> {
  const { data } = await apiClient.get<SonarFile>(`/uploads/${sonarFileId}`)
  return data
}

/** Fetched as a blob (not a plain <img src>) because the endpoint requires the Authorization
 * header attached by apiClient's interceptor - browsers can't attach custom headers to a bare
 * <img> request. Caller is responsible for revoking the returned object URL when done. */
export async function getSonarFileImageObjectUrl(sonarFileId: string): Promise<string> {
  const { data } = await apiClient.get(`/uploads/${sonarFileId}/image`, { responseType: 'blob' })
  return URL.createObjectURL(data as Blob)
}
