import type { CollectionSummary, LegoSet, LegoSetNameLookup, LegoSetPayload, LoginResponse, TokenPair, User } from './types'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/atypibrick/v1').replace(/\/$/, '')
const ACCESS_TOKEN_KEY = 'atypibrick_token'
const REFRESH_TOKEN_KEY = 'atypibrick_refresh_token'

export function saveSession(tokens: TokenPair) {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function hasSession() {
  return Boolean(localStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(REFRESH_TOKEN_KEY))
}

let refreshPromise: Promise<boolean> | null = null

async function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (!refreshToken) return false
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!response.ok) return false
    saveSession(await response.json() as TokenPair)
    return true
  })().catch(() => false).finally(() => { refreshPromise = null })
  return refreshPromise
}

async function request<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY)
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers } })
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
  list: (query = '') => request<LegoSet[]>(`/collection${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  summary: () => request<CollectionSummary>('/collection/summary'),
  create: (payload: LegoSetPayload) => request<LegoSet>('/collection', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: LegoSetPayload) => request<LegoSet>(`/collection/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  remove: (id: string) => request<void>(`/collection/${id}`, { method: 'DELETE' }),
}

export const legoSetApi = {
  lookup: (setNumber: string) => request<LegoSetNameLookup>(`/sets/lookup?setNumber=${encodeURIComponent(setNumber)}`),
}

export const authApi = {
  login: (email: string, password: string) => request<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<User>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string, confirmation: string) => request<void>('/auth/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword, confirmation }) }),
}
