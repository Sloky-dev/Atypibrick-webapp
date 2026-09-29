import { useEffect, useState } from 'react'
import { Box, RotateCcw, Trash2, UserRound } from 'lucide-react'
import { trashApi } from '../api'
import { minifigureApi } from '../minifigures'

type TrashEntry = { id: string; kind: 'set' | 'minifigure'; name: string; reference: string; imageUrl: string | null; deletedAt: string; expiresAt: string | null }

type Props = { onRestored: () => Promise<void> }

export function TrashPage({ onRestored }: Props) {
  const [items, setItems] = useState<TrashEntry[] | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setError('')
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
  }, [retry])
  const restore = async (item: TrashEntry) => {
    setRestoring(`${item.kind}:${item.id}`); setError('')
    try { if (item.kind === 'set') await trashApi.restore(item.id); else await minifigureApi.restore(item.id); setItems((current) => current?.filter((candidate) => candidate.id !== item.id || candidate.kind !== item.kind) ?? []); await onRestored() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Restauration impossible') }
    finally { setRestoring(null) }
  }
  const remainingDays = (expiresAt: string) => Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000))
  return <section className="trash-page"><div className="pick-page-heading"><span className="eyebrow">RESTAURATION</span><h1>Corbeille</h1></div><div className="trash-notice"><Trash2 /><p>Retrouvez ici vos sets et minifigurines supprimés. Les sets sont conservés 30 jours ; les minifigurines restent disponibles jusqu’à leur restauration.</p></div>{items === null && !error && <div className="inventory-complete"><div className="loader" /><p>Chargement…</p></div>}{items?.length === 0 && <div className="inventory-complete"><Trash2 /><h3>La corbeille est vide</h3><p>Aucun set ni minifigurine supprimé.</p></div>}{items && items.length > 0 && <div className="trash-list">{items.map((item) => <article key={`${item.kind}:${item.id}`}><span className="trash-thumb">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : item.kind === 'set' ? <Box /> : <UserRound />}</span><div><small>{item.reference} · Supprimé le {new Date(item.deletedAt).toLocaleDateString('fr-FR')}</small><strong>{item.name}</strong><p>{item.expiresAt ? `Suppression définitive dans ${remainingDays(item.expiresAt)} jours` : 'Restauration disponible'}</p></div><button className="button" disabled={Boolean(restoring)} onClick={() => void restore(item)}><RotateCcw /> {restoring === `${item.kind}:${item.id}` ? 'Restauration…' : 'Restaurer'}</button></article>)}</div>}{error && <div className="form-error" role="alert">{error}{items === null && <button className="button ghost" onClick={() => setRetry((value) => value + 1)}>Réessayer</button>}</div>}</section>
}
