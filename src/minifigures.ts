import { collectionMutation } from './collectionEvents'
import { request } from './api'

export type MiniCharacterInput = { name: string; catalogReference: string | null }
export type MiniCharacter = MiniCharacterInput & { id: string; seriesId: string; imageUrl?: string | null; copyCount?: number }
export type MiniSeriesInput = { name: string; brand: string; reference: string | null; theme: string; expectedCount: number | null; characters: MiniCharacterInput[] }
export type MiniSeries = Omit<MiniSeriesInput, 'characters'> & { id: string; isStandalone?: boolean; copyCount?: number; ownedCount?: number; unknownCount?: number; characters: MiniCharacter[] }
export type MiniCopyInput = { seriesId: string; characterId: string | null; purchasePrice: string; purchaseDate: string | null; condition: 'Neuf' | 'Occasion'; sealed: boolean; accessoriesComplete: boolean; isGift: boolean; sourceSetId: string | null; includedInSet: boolean; notes: string }
export type MiniCopy = MiniCopyInput & { id: string; createdAt: string; deletedAt: string | null }
export type MiniBreakdown = { label: string; count: number }
export type MiniSummary = { copyCount: number; characterCount: number; duplicateCount: number; invested: string; bySeries: MiniBreakdown[]; seriesProgress: MiniBreakdown[]; conditions: MiniBreakdown[]; purchaseYears: MiniBreakdown[]; accessories: MiniBreakdown[]; latestCopy: MiniCopy | null }
export type MiniCopyPage = { items: MiniCopy[]; hasMore: boolean; nextCursor: string | null }
export type MiniOwnedGroup = { seriesId: string; characterId: string | null; count: number }
export type MiniOwnedPage = { items: MiniOwnedGroup[]; hasMore: boolean; nextCursor: string | null }
export const minifigureApi = {
  seriesList: () => request<MiniSeries[]>('/minifigures/series'),
  summary: (includeLatest = false) => request<MiniSummary>(`/minifigures/summary${includeLatest ? '?includeLatest=true' : ''}`),
  owned: (search = '', seriesId = '', state = '', cursor: string | null = null) => { const params = new URLSearchParams({ limit: '24' }); if (search) params.set('q', search); if (seriesId) params.set('seriesId', seriesId); if (state) params.set('state', state); if (cursor) params.set('cursor', cursor); return request<MiniOwnedPage>(`/minifigures/owned?${params}`) },
  copies: (seriesId: string, characterId: string | null, cursor: string | null = null) => { const params = new URLSearchParams({ seriesId, characterId: characterId || 'unknown', limit: '12' }); if (cursor) params.set('cursor', cursor); return request<MiniCopyPage>(`/minifigures/copies?${params}`) },
  standalone: (data: MiniCharacterInput) => request<MiniSeries>('/minifigures/standalone', { method: 'POST', body: JSON.stringify(data) }),
  lookupSeries: (reference: string) => request<MiniSeriesInput>(`/minifigures/catalog/${encodeURIComponent(reference)}`),
  catalog: () => request<MiniSeriesInput[]>('/minifigures/catalog'),
  series: (data: MiniSeriesInput) => request<MiniSeries>('/minifigures/series', { method: 'POST', body: JSON.stringify(data) }),
  save: (data: MiniCopyInput, id?: string) => collectionMutation(request<MiniCopy>(`/minifigures/copies${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) })),
  remove: (id: string) => collectionMutation(request<void>(`/minifigures/copies/${id}`, { method: 'DELETE' })),
  restore: (id: string) => collectionMutation(request<MiniCopy>(`/minifigures/copies/${id}/restore`, { method: 'POST' })),
  trash: () => request<MiniCopy[]>('/minifigures/trash'),
}
