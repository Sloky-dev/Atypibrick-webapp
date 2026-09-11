import { useEffect, useState } from 'react'
import { Box, RotateCcw, Trash2, X } from 'lucide-react'
import { trashApi } from '../api'
import type { TrashItem } from '../types'

type Props = { onClose: () => void; onRestored: () => Promise<void> }

export function TrashModal({ onClose, onRestored }: Props) {
  const [items, setItems] = useState<TrashItem[] | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { trashApi.list().then(setItems).catch((reason) => setError(reason instanceof Error ? reason.message : 'Chargement impossible')) }, [])
  const restore = async (item: TrashItem) => {
    setRestoring(item.id); setError('')
    try { await trashApi.restore(item.id); setItems((current) => current?.filter((candidate) => candidate.id !== item.id) ?? []); await onRestored() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Restauration impossible') }
    finally { setRestoring(null) }
  }
  const remainingDays = (expiresAt: string) => Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000))
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal trash-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="eyebrow">RESTAURATION</span><h2>Corbeille</h2></div><button className="icon-button" onClick={onClose} aria-label="Fermer"><X /></button></div><div className="trash-notice"><Trash2 /><p>Les sets supprimés restent disponibles pendant 30 jours, puis sont définitivement effacés automatiquement.</p></div>{items === null && !error && <div className="inventory-complete"><div className="loader" /><p>Chargement…</p></div>}{items?.length === 0 && <div className="inventory-complete"><Trash2 /><h3>La corbeille est vide</h3><p>Aucun set en attente de suppression définitive.</p></div>}{items && items.length > 0 && <div className="trash-list">{items.map((item) => <article key={item.id}><span className="trash-thumb">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <Box />}</span><div><small>#{item.setNumber} · Supprimé le {new Date(item.deletedAt).toLocaleDateString('fr-FR')}</small><strong>{item.name}</strong><p>Suppression définitive dans {remainingDays(item.expiresAt)} jour{remainingDays(item.expiresAt) > 1 ? 's' : ''}</p></div><button className="button" disabled={Boolean(restoring)} onClick={() => void restore(item)}><RotateCcw /> {restoring === item.id ? 'Restauration…' : 'Restaurer'}</button></article>)}</div>}{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button className="button ghost" onClick={onClose}>Fermer</button></div></section></div>
}
