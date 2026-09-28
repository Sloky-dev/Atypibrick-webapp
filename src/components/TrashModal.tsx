import { useEffect, useState } from 'react'
import { Box, RotateCcw, Trash2, UserRound, X } from 'lucide-react'
import { trashApi } from '../api'
import { minifigureApi } from '../minifigures'

type TrashEntry = { id: string; kind: 'set' | 'minifigure'; name: string; reference: string; imageUrl: string | null; deletedAt: string; expiresAt: string | null }

type Props = { onClose: () => void; onRestored: () => Promise<void> }

export function TrashModal({ onClose, onRestored }: Props) {
  const [items, setItems] = useState<TrashEntry[] | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    Promise.all([trashApi.list(), minifigureApi.trash(), minifigureApi.list()]).then(([sets, copies, collection]) => {
      const entries: TrashEntry[] = sets.map((item) => ({ id: item.id, kind: 'set', name: item.name, reference: `Set · #${item.setNumber}`, imageUrl: item.imageUrl, deletedAt: item.deletedAt, expiresAt: item.expiresAt }))
      for (const copy of copies) {
        const series = collection.series.find((item) => item.id === copy.seriesId)
        const character = series?.characters.find((item) => item.id === copy.characterId)
        entries.push({ id: copy.id, kind: 'minifigure', name: character?.name || 'Personnage inconnu — boîte scellée', reference: `Minifigurine · ${series?.name || 'Série inconnue'}`, imageUrl: character?.imageUrl || null, deletedAt: copy.deletedAt!, expiresAt: null })
      }
      entries.sort((a, b) => Date.parse(b.deletedAt) - Date.parse(a.deletedAt))
      if (active) setItems(entries)
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Chargement impossible') })
    return () => { active = false }
  }, [])
  const restore = async (item: TrashEntry) => {
    setRestoring(`${item.kind}:${item.id}`); setError('')
    try { if (item.kind === 'set') await trashApi.restore(item.id); else await minifigureApi.restore(item.id); setItems((current) => current?.filter((candidate) => candidate.id !== item.id || candidate.kind !== item.kind) ?? []); await onRestored() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Restauration impossible') }
    finally { setRestoring(null) }
  }
  const remainingDays = (expiresAt: string) => Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000))
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal trash-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="eyebrow">RESTAURATION</span><h2>Corbeille</h2></div><button className="icon-button" onClick={onClose} aria-label="Fermer"><X /></button></div><div className="trash-notice"><Trash2 /><p>Retrouvez ici vos sets et minifigurines supprimés. Les sets sont conservés 30 jours ; les minifigurines restent disponibles jusqu’à leur restauration.</p></div>{items === null && !error && <div className="inventory-complete"><div className="loader" /><p>Chargement…</p></div>}{items?.length === 0 && <div className="inventory-complete"><Trash2 /><h3>La corbeille est vide</h3><p>Aucun set ni minifigurine supprimé.</p></div>}{items && items.length > 0 && <div className="trash-list">{items.map((item) => <article key={`${item.kind}:${item.id}`}><span className="trash-thumb">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : item.kind === 'set' ? <Box /> : <UserRound />}</span><div><small>{item.reference} · Supprimé le {new Date(item.deletedAt).toLocaleDateString('fr-FR')}</small><strong>{item.name}</strong><p>{item.expiresAt ? `Suppression définitive dans ${remainingDays(item.expiresAt)} jours` : 'Restauration disponible'}</p></div><button className="button" disabled={Boolean(restoring)} onClick={() => void restore(item)}><RotateCcw /> {restoring === `${item.kind}:${item.id}` ? 'Restauration…' : 'Restaurer'}</button></article>)}</div>}{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button className="button ghost" onClick={onClose}>Fermer</button></div></section></div>
}
