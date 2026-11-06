import { createContext, lazy, Suspense, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { collectionApi, trashApi } from '../api'
import type { LegoSet, LegoSetPayload } from '../types'
import { useNotifications } from './NotificationsProvider'

const SetForm = lazy(() => import('./SetForm').then((module) => ({ default: module.SetForm })))
const InventoryModal = lazy(() => import('./InventoryModal').then((module) => ({ default: module.InventoryModal })))
const MissingPartsModal = lazy(() => import('./MissingPartsModal').then((module) => ({ default: module.MissingPartsModal })))
type Actions = { openCreate: () => void; openEdit: (item: LegoSet) => void; openMissingParts: (item: LegoSet) => void; openInventory: () => void; remove: (item: LegoSet) => Promise<void>; busy: boolean }
const Context = createContext<Actions | null>(null)
export function useSetActions() {
  const context = useContext(Context)
  if (!context) throw new Error('SetActionsProvider is missing')
  return context
}
export function SetActionsProvider({ children }: { children: ReactNode }) {
  const { notify, undoBusy } = useNotifications()
  const [form, setForm] = useState<{ item: LegoSet | null } | null>(null)
  const [inventory, setInventory] = useState(false)
  const [missing, setMissing] = useState<LegoSet | null>(null)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const openCreate = useCallback(() => setForm({ item: null }), [])
  const openEdit = useCallback((item: LegoSet) => setForm({ item }), [])
  const openMissingParts = useCallback((item: LegoSet) => setMissing(item), [])
  const openInventory = useCallback(() => setInventory(true), [])
  const save = async (payload: LegoSetPayload) => {
    if (form?.item) await collectionApi.update(form.item.id, payload); else await collectionApi.create(payload)
    notify(form?.item ? 'Modifications enregistrées.' : 'Set ajouté à votre collection.')
    setForm(null)
  }
  const remove = async (item: LegoSet) => {
    if (pending.current || undoBusy) return
    pending.current = true; setBusy(true)
    try {
      await collectionApi.remove(item.id)
      notify(`« ${item.name} » placé dans la corbeille.`, { undo: async () => { await trashApi.restore(item.id); notify('Suppression annulée. Le set a été restauré.') } })
    } catch (reason) { notify(reason instanceof Error ? reason.message : 'Impossible de supprimer le set.', { error: true }) }
    finally { pending.current = false; setBusy(false) }
  }
  return <Context.Provider value={{ openCreate, openEdit, openMissingParts, openInventory, remove, busy: busy || undoBusy }}>{children}<Suspense fallback={<div className="modal-backdrop"><section className="modal" role="status">Chargement…</section></div>}>
    {form && <SetForm item={form.item} onClose={() => setForm(null)} onSubmit={save} />}
    {inventory && <InventoryModal onClose={() => setInventory(false)} onCompleted={async () => setInventory(false)} />}
    {missing?.brand === 'LEGO' && <MissingPartsModal set={missing} onClose={() => setMissing(null)} onChange={(count) => setMissing((current) => current ? { ...current, missingPartsCount: count } : current)} />}
  </Suspense></Context.Provider>
}
