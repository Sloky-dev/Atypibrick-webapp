import type { CollectionFilters, CollectionSummary, InventoryOverview, InventorySession, LegoSet, LegoSetNameLookup, LegoSetPage, LegoSetPayload, LoginResponse, MissingPart, PickABrickPart, TokenPair, TrashItem, User } from './types'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/atypibrick/v1').replace(/\/$/, '')
const ACCESS_TOKEN_KEY = 'atypibrick_token'

export function saveSession(tokens: TokenPair) {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem('atypibrick_refresh_token')
}

let refreshPromise: Promise<boolean> | null = null

async function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) return false
    saveSession(await response.json() as TokenPair)
    return true
  })().catch(() => false).finally(() => { refreshPromise = null })
  return refreshPromise
}

async function request<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY)
  const response = await fetch(`${API_URL}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers } })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    if (response.status === 401 && path !== '/auth/login' && path !== '/auth/refresh') {
      if (retry && await refreshSession()) return request<T>(path, init, false)
      clearSession()
      window.dispatchEvent(new Event('atypibrick:unauthorized'))
    }
    throw new Error(body?.detail || `Erreur API (${response.status})`)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

export const collectionApi = {
  list: (query = '', cursor: string | null = null, limit = 9, filters?: CollectionFilters) => {
    const params = new URLSearchParams({ limit: String(limit) })
    if (query) params.set('q', query)
    if (cursor) params.set('cursor', cursor)
    if (filters) {
      if (filters.theme) params.set('theme', filters.theme)
      if (filters.condition) params.set('condition', filters.condition)
      if (filters.gift) params.set('isGift', filters.gift)
      if (filters.purchaseDateFrom) params.set('purchaseDateFrom', filters.purchaseDateFrom)
      if (filters.purchaseDateTo) params.set('purchaseDateTo', filters.purchaseDateTo)
      if (filters.priceMin) params.set('priceMin', filters.priceMin)
      if (filters.priceMax) params.set('priceMax', filters.priceMax)
      if (filters.partsMin) params.set('partsMin', filters.partsMin)
      if (filters.partsMax) params.set('partsMax', filters.partsMax)
      params.set('sort', filters.sort)
    }
    return request<LegoSetPage>(`/collection?${params}`)
  },
  summary: () => request<CollectionSummary>('/collection/summary'),
  create: (payload: LegoSetPayload) => request<LegoSet>('/collection', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: LegoSetPayload) => request<LegoSet>(`/collection/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  repairImage: (id: string) => request<LegoSet>(`/collection/${id}/image`, { method: 'POST' }),
  removeMany: (ids: string[]) => request<void>('/collection/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }),
  remove: (id: string) => request<void>(`/collection/${id}`, { method: 'DELETE' }),
}

export const legoSetApi = {
  lookup: (setNumber: string) => request<LegoSetNameLookup>(`/sets/lookup?setNumber=${encodeURIComponent(setNumber)}`),
}

export const inventoryApi = {
  overview: () => request<InventoryOverview>('/inventory'),
  start: () => request<InventorySession>('/inventory', { method: 'POST' }),
  markPresent: (sessionId: string, itemId: string, present: boolean) => request<InventorySession>(`/inventory/${sessionId}/items/${itemId}`, { method: 'PUT', body: JSON.stringify({ present }) }),
  complete: (sessionId: string, deleteMissing: boolean) => request<InventorySession>(`/inventory/${sessionId}/complete`, { method: 'POST', body: JSON.stringify({ deleteMissing }) }),
}

export const trashApi = {
  list: () => request<TrashItem[]>('/trash'),
  restore: (id: string) => request<void>(`/trash/${id}/restore`, { method: 'POST' }),
}

export const missingPartsApi = {
  lookup: (reference: string) => request<PickABrickPart[]>(`/parts/lookup?reference=${encodeURIComponent(reference)}`),
  list: (setId: string) => request<MissingPart[]>(`/parts/sets/${setId}`),
  add: (setId: string, elementId: string, quantity: number) => request<MissingPart>(`/parts/sets/${setId}`, { method: 'POST', body: JSON.stringify({ elementId, quantity }) }),
  refresh: (id: string) => request<MissingPart>(`/parts/${id}/refresh`, { method: 'POST' }),
  remove: (id: string) => request<void>(`/parts/${id}`, { method: 'DELETE' }),
}

export const authApi = {
  login: (email: string, password: string) => request<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<User>('/auth/me'),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  changePassword: async (currentPassword: string, newPassword: string, confirmation: string) => {
    await request<void>('/auth/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword, confirmation }) })
    clearSession()
    window.dispatchEvent(new Event('atypibrick:unauthorized'))
  },
}
