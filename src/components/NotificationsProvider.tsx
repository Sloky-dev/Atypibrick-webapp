import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

type Notice = { id: number; message: string; error: boolean; expiresAt: number; undo?: () => Promise<void> }
type Notifications = { notify: (message: string, options?: { error?: boolean; undo?: () => Promise<void> }) => void; undoBusy: boolean }
const Context = createContext<Notifications | null>(null)
export function useNotifications() {
  const context = useContext(Context)
  if (!context) throw new Error('NotificationsProvider is missing')
  return context
}
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([])
  const [undoing, setUndoing] = useState<number | null>(null)
  const pending = useRef(false)
  const sequence = useRef(0)
  const notify = useCallback((message: string, options: { error?: boolean; undo?: () => Promise<void> } = {}) => {
    setNotices((current) => [...current, { id: ++sequence.current, message, error: !!options.error, undo: options.undo, expiresAt: Date.now() + (options.error || options.undo ? 10000 : 5000) }])
  }, [])
  useEffect(() => {
    if (!notices.length || undoing !== null) return
    const timer = window.setTimeout(() => setNotices((current) => current.filter((notice) => notice.expiresAt > Date.now())), Math.max(0, Math.min(...notices.map((notice) => notice.expiresAt)) - Date.now()))
    return () => window.clearTimeout(timer)
  }, [notices, undoing])
  const undo = async (notice: Notice) => {
    if (!notice.undo || pending.current) return
    pending.current = true; setUndoing(notice.id)
    try { await notice.undo(); setNotices((current) => current.filter((item) => item.id !== notice.id)) }
    catch (reason) { notify(reason instanceof Error ? reason.message : 'Impossible de restaurer le set. Réessayez.', { error: true }) }
    finally { pending.current = false; setUndoing(null) }
  }
  return <Context.Provider value={{ notify, undoBusy: undoing !== null }}>{children}<div className="action-notices" aria-label="Notifications">{notices.map((notice) => <div className={`action-notice ${notice.error ? 'is-error' : ''}`} key={notice.id}><span role={notice.error ? 'alert' : 'status'}>{notice.message}</span>{notice.undo && <button type="button" disabled={undoing !== null} onClick={() => void undo(notice)}>Annuler la suppression</button>}<button type="button" disabled={undoing !== null} aria-label="Fermer la notification" onClick={() => setNotices((current) => current.filter((item) => item.id !== notice.id))}><X size={16} /></button></div>)}</div></Context.Provider>
}
