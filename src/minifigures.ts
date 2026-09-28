import { request } from './api'

export type MiniCharacterInput = { name: string; catalogReference: string | null; imageUrl: string | null }
export type MiniCharacter = MiniCharacterInput & { id: string; seriesId: string }
export type MiniSeriesInput = { name: string; brand: string; reference: string | null; theme: string; expectedCount: number | null; characters: MiniCharacterInput[] }
export type MiniSeries = Omit<MiniSeriesInput, 'characters'> & { id: string; characters: MiniCharacter[] }
export type MiniCopyInput = { seriesId: string; characterId: string | null; purchasePrice: string; purchaseDate: string | null; condition: 'Neuf' | 'Occasion'; sealed: boolean; accessoriesComplete: boolean; isGift: boolean; sourceSetId: string | null; includedInSet: boolean; notes: string; imageUrl: string | null }
export type MiniCopy = MiniCopyInput & { id: string; createdAt: string; deletedAt: string | null }
export type MiniCollection = { series: MiniSeries[]; copies: MiniCopy[] }
export const minifigureApi = {
  list: () => request<MiniCollection>('/minifigures'),
  catalog: () => request<MiniSeriesInput[]>('/minifigures/catalog'),
  series: (data: MiniSeriesInput) => request<MiniSeries>('/minifigures/series', { method: 'POST', body: JSON.stringify(data) }),
  character: (seriesId: string, data: MiniCharacterInput) => request<MiniCharacter>(`/minifigures/series/${seriesId}/characters`, { method: 'POST', body: JSON.stringify(data) }),
  updateCharacter: (seriesId: string, id: string, data: MiniCharacterInput) => request<MiniCharacter>(`/minifigures/series/${seriesId}/characters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  save: (data: MiniCopyInput, id?: string) => request<MiniCopy>(`/minifigures/copies${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) }),
  remove: (id: string) => request<void>(`/minifigures/copies/${id}`, { method: 'DELETE' }),
  restore: (id: string) => request<MiniCopy>(`/minifigures/copies/${id}/restore`, { method: 'POST' }),
  trash: () => request<MiniCopy[]>('/minifigures/trash'),
}

export async function miniPhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choisissez une photo JPEG, PNG ou WebP.')
  if (file.size > 15 * 1024 * 1024) throw new Error('Choisissez une photo de moins de 15 Mo.')
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    const ratio = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height))
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Impossible de préparer la photo.')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const result = canvas.toDataURL('image/webp', 0.75)
    if (result.length > 500000) throw new Error('Cette photo reste trop volumineuse. Choisissez une image plus petite.')
    return result
  } finally { bitmap.close() }
}
