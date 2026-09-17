// Persist each captured image before upload. Retrying uses the same capture UUID.
export type PendingCapture = { id: string; roomId: string; blob: Blob; createdAt: number }
const database = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('atypibrick-room-captures', 1)
  request.onupgradeneeded = () => request.result.createObjectStore('captures', { keyPath: 'id' })
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(new Error('Impossible de conserver la photo sur ce téléphone. Vérifiez l’espace disponible.'))
})

async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('captures', mode)
    const result = action(tx.objectStore('captures'))
    tx.oncomplete = () => { db.close(); resolve(result.result) }
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error('La sauvegarde locale a échoué. Vérifiez l’espace disponible.')) }
  })
}

export const captureStore = {
  save: (capture: PendingCapture) => transaction('readwrite', (store) => store.put(capture)),
  remove: (id: string) => transaction('readwrite', (store) => store.delete(id)),
  list: async (roomId: string) => (await transaction('readonly', (store) => store.getAll()) as PendingCapture[]).filter((item) => item.roomId === roomId).sort((a, b) => a.createdAt - b.createdAt),
}
