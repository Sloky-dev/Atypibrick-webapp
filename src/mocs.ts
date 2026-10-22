import { request } from './api'

export type Moc = {
  id: string; name: string; baseSetId: string | null; baseSetNumber: string; baseSetName: string; baseSetBrand: string
  builtAt: string | null; notes: string; instructionName: string | null; createdAt: string
}
export type MocInput = { name: string; baseSetId: string | null; builtAt: string | null; notes: string; removeInstruction: boolean }
export type MocBaseSet = { id: string; name: string; brand: string; setNumber: string }
export const MAX_NOTICE_BYTES = 9 * 1024 * 1024

export const mocsApi = {
  list: () => request<Moc[]>('/mocs'),
  baseSets: (query: string) => request<MocBaseSet[]>(`/mocs/base-sets?q=${encodeURIComponent(query)}`),
  save: (id: string | null, input: MocInput, notice: File | null) => {
    const body = new FormData()
    body.append('data', JSON.stringify(input))
    if (notice) body.append('notice', notice)
    return request<Moc>(id ? `/mocs/${id}` : '/mocs', { method: id ? 'PUT' : 'POST', body })
  },
  download: (id: string) => request<Blob>(`/mocs/${id}/notice`),
  remove: (id: string) => request<void>(`/mocs/${id}`, { method: 'DELETE' }),
}
