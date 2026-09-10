import type { CollectionSummary, LegoSet, LegoSetPayload, LoginResponse, User } from './types'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/atypibrick/v1').replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('atypibrick_token')
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers } })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    if (response.status === 401 && path !== '/auth/login') {
      localStorage.removeItem('atypibrick_token')
      window.dispatchEvent(new Event('atypibrick:unauthorized'))
    }
    throw new Error(body?.detail || `Erreur API (${response.status})`)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

export const collectionApi = {
  list: (query = '') => request<LegoSet[]>(`/collection${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  summary: () => request<CollectionSummary>('/collection/summary'),
  create: (payload: LegoSetPayload) => request<LegoSet>('/collection', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: LegoSetPayload) => request<LegoSet>(`/collection/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  remove: (id: string) => request<void>(`/collection/${id}`, { method: 'DELETE' }),
}

export const authApi = {
  login: (email: string, password: string) => request<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<User>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string, confirmation: string) => request<void>('/auth/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword, confirmation }) }),
}
