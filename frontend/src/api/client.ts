import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/auth'
import type { ApiErrorBody, TokenPair } from './types'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken
  if (!refreshToken) return null
  try {
    const { data } = await axios.post<TokenPair>(`${API_BASE_URL}/auth/refresh`, {
      refresh_token: refreshToken,
    })
    useAuthStore.getState().setTokens(data.access_token, data.refresh_token)
    return data.access_token
  } catch {
    useAuthStore.getState().logout()
    return null
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined
    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null
        })
      }
      const newToken = await refreshPromise
      if (newToken) {
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` }
        return apiClient.request(original)
      }
    }
    return Promise.reject(error)
  },
)

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiErrorBody | undefined
    if (body?.error?.message) return body.error.message
    if (error.message) return error.message
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}
