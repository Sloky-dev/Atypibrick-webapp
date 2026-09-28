import { request } from './api'

export type MiniCharacterInput = { name: string; catalogReference: string | null }
export type MiniCharacter = MiniCharacterInput & { id: string; seriesId: string; imageUrl?: string | null }
export type MiniSeriesInput = { name: string; brand: string; reference: string | null; theme: string; expectedCount: number | null; characters: MiniCharacterInput[] }
export type MiniSeries = Omit<MiniSeriesInput, 'characters'> & { id: string; characters: MiniCharacter[] }
export type MiniCopyInput = { seriesId: string; characterId: string | null; purchasePrice: string; purchaseDate: string | null; condition: 'Neuf' | 'Occasion'; sealed: boolean; accessoriesComplete: boolean; isGift: boolean; sourceSetId: string | null; includedInSet: boolean; notes: string }
export type MiniCopy = MiniCopyInput & { id: string; createdAt: string; deletedAt: string | null }
export type MiniCollection = { series: MiniSeries[]; copies: MiniCopy[] }
export const minifigureApi = {
  list: () => request<MiniCollection>('/minifigures'),
  images: (id: string) => request<MiniSeries>(`/minifigures/series/${id}/images`, { method: 'POST' }),
  catalog: () => request<MiniSeriesInput[]>('/minifigures/catalog'),
  series: (data: MiniSeriesInput) => request<MiniSeries>('/minifigures/series', { method: 'POST', body: JSON.stringify(data) }),
  character: (seriesId: string, data: MiniCharacterInput) => request<MiniCharacter>(`/minifigures/series/${seriesId}/characters`, { method: 'POST', body: JSON.stringify(data) }),
  updateCharacter: (seriesId: string, id: string, data: MiniCharacterInput) => request<MiniCharacter>(`/minifigures/series/${seriesId}/characters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  save: (data: MiniCopyInput, id?: string) => request<MiniCopy>(`/minifigures/copies${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) }),
  remove: (id: string) => request<void>(`/minifigures/copies/${id}`, { method: 'DELETE' }),
  restore: (id: string) => request<MiniCopy>(`/minifigures/copies/${id}/restore`, { method: 'POST' }),
  trash: () => request<MiniCopy[]>('/minifigures/trash'),
}
