import type { CollectionSummary, LegoSet, LegoSetPayload } from './types'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/atypibrick/v1').replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
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
