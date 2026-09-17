import { request } from './api'

export type Room = {
  id: string; name: string; status: 'capture' | 'queued' | 'processing' | 'ready' | 'failed'
  stage: string; error: string | null; photoCount: number; pointCount: number; registeredImages: number; createdAt: string
}
export type Position = { x: number; y: number; z: number }
export type RoomMarker = Position & { id: string; label: string; sets: { id: string; name: string; setNumber: string }[] }
export type RoomPhoto = { id: string; captureId: string }
export type RoomLocation = { roomId: string; roomName: string; markerId: string; label: string }
export type RoomCapabilities = { workerAvailable: boolean; minPhotos: number; maxPhotos: number }
const path = (id: string) => `/rooms/${id}`

export const brickRoomApi = {
  list: () => request<Room[]>('/rooms'),
  capabilities: () => request<RoomCapabilities>('/rooms/capabilities'),
  create: (name: string) => request<Room>('/rooms', { method: 'POST', body: JSON.stringify({ name }) }),
  get: (id: string) => request<Room>(path(id)),
  remove: (id: string) => request<void>(path(id), { method: 'DELETE' }),
  photos: (id: string) => request<RoomPhoto[]>(`${path(id)}/photos`),
  photo: (id: string, photo: string) => request<Blob>(`${path(id)}/photos/${photo}`),
  upload: (id: string, capture: string, blob: Blob) => request<RoomPhoto>(`${path(id)}/photos/${capture}`, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } }),
  deletePhoto: (id: string, photo: string) => request<void>(`${path(id)}/photos/${photo}`, { method: 'DELETE' }),
  reconstruct: (id: string) => request<Room>(`${path(id)}/reconstruct`, { method: 'POST' }),
  model: (id: string) => request<Blob>(`${path(id)}/model`),
  markers: (id: string) => request<RoomMarker[]>(`${path(id)}/markers`),
  createMarker: (id: string, label: string, position: Position) => request<RoomMarker>(`${path(id)}/markers`, { method: 'POST', body: JSON.stringify({ label, ...position }) }),
  deleteMarker: (id: string, marker: string) => request<void>(`${path(id)}/markers/${marker}`, { method: 'DELETE' }),
  place: (id: string, marker: string, set: string) => request<void>(`${path(id)}/markers/${marker}/sets/${set}`, { method: 'PUT' }),
  unplace: (id: string, marker: string, set: string) => request<void>(`${path(id)}/markers/${marker}/sets/${set}`, { method: 'DELETE' }),
  locations: (set: string) => request<RoomLocation[]>(`/rooms/locations/${set}`),
}
