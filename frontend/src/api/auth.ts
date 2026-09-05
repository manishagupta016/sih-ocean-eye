import { apiClient } from './client'
import type { ApiKeyCreated, ApiKeyRead, TokenPair, User, UserRole } from './types'

export interface RegisterPayload {
  name: string
  email: string
  password: string
  role: UserRole
}

export async function register(payload: RegisterPayload): Promise<TokenPair> {
  const { data } = await apiClient.post<TokenPair>('/auth/register', payload)
  return data
}

export async function login(email: string, password: string): Promise<TokenPair> {
  const body = new URLSearchParams()
  body.set('username', email)
  body.set('password', password)
  const { data } = await apiClient.post<TokenPair>('/auth/login', body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return data
}

export async function fetchMe(): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/me')
  return data
}

export async function updateMe(name: string): Promise<User> {
  const { data } = await apiClient.patch<User>('/auth/me', { name })
  return data
}

export async function createApiKey(label: string): Promise<ApiKeyCreated> {
  const { data } = await apiClient.post<ApiKeyCreated>('/auth/api-keys', { label })
  return data
}

export async function listApiKeys(): Promise<ApiKeyRead[]> {
  const { data } = await apiClient.get<ApiKeyRead[]>('/auth/api-keys')
  return data
}

export async function revokeApiKey(id: string): Promise<void> {
  await apiClient.delete(`/auth/api-keys/${id}`)
}
