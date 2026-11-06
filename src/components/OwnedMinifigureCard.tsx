import { useEffect, useRef, useState } from 'react'
import { Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { minifigureApi, type MiniCopy, type MiniCopyPage, type MiniOwnedGroup, type MiniSeries } from '../minifigures'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
export function OwnedMinifigureCard({ series, group, revision, busy, onEdit, onRemove }: { series: MiniSeries; group: MiniOwnedGroup; revision: number; busy: boolean; onEdit: (series: MiniSeries, characterId: string | null, copy?: MiniCopy) => void; onRemove: (copy: MiniCopy) => Promise<void> }) {
  const character = series.characters.find((item) => item.id === group.characterId)
  const name = character?.name || 'Personnage inconnu — boîte scellée'
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState<MiniCopyPage>({ items: [], hasMore: false, nextCursor: null })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const generation = useRef(0)
  useEffect(() => {
    const current = ++generation.current
    if (!open) return
    setLoading(true); setError(''); setPage({ items: [], hasMore: false, nextCursor: null })
    void minifigureApi.copies(series.id, group.characterId).then((result) => { if (current === generation.current) setPage(result) }).catch((reason) => { if (current === generation.current) setError(reason instanceof Error ? reason.message : 'Chargement impossible') }).finally(() => { if (current === generation.current) setLoading(false) })
    return () => { generation.current++ }
  }, [open, series.id, group.characterId, revision, retry])
  const more = async () => {
    if (!page.nextCursor || loading) return
    const current = generation.current
    setLoading(true); setError('')
    try { const result = await minifigureApi.copies(series.id, group.characterId, page.nextCursor); if (current === generation.current) setPage((previous) => ({ ...result, items: [...previous.items, ...result.items.filter((copy) => !previous.items.some((item) => item.id === copy.id))] })) }
    catch (reason) { if (current === generation.current) setError(reason instanceof Error ? reason.message : 'Chargement impossible') }
    finally { if (current === generation.current) setLoading(false) }
  }
  return <article className="mini-owned-card"><div className="mini-image">{character?.imageUrl ? <img src={character.imageUrl} alt={name} loading="lazy" /> : <UserRound />}</div><small>{series.name} {series.reference ? `· #${series.reference}` : ''}</small><h3>{name} <span>×{group.count}</span></h3><button className="button ghost" onClick={() => onEdit(series, group.characterId)}><Plus /> Ajouter un exemplaire</button>
    <details onToggle={(event) => setOpen(event.currentTarget.open)}><summary>Voir les {group.count} exemplaire{group.count > 1 ? 's' : ''}</summary>{page.items.map((copy) => <div className="mini-copy" key={copy.id}><p>{copy.condition} · {copy.includedInSet ? 'Incluse dans un set' : copy.isGift ? 'Cadeau' : euro.format(Number(copy.purchasePrice))}{copy.sealed ? ' · Scellée' : ''}{!copy.accessoriesComplete ? ' · Accessoires incomplets' : ''}</p>{copy.purchaseDate && <small>Achat : {new Date(`${copy.purchaseDate}T12:00:00`).toLocaleDateString('fr-FR')}</small>}{copy.notes && <p>{copy.notes}</p>}<div><button aria-label={`Modifier ${name}`} onClick={() => onEdit(series, copy.characterId, copy)}><Pencil size={16} /> {copy.characterId ? 'Modifier' : 'Identifier / modifier'}</button><button disabled={busy} aria-label={`Supprimer ${name}`} onClick={() => void onRemove(copy)}><Trash2 size={16} /></button></div></div>)}{loading && <p role="status">Chargement des exemplaires…</p>}{error && <p role="alert">{error}<button onClick={() => page.items.length ? void more() : setRetry((value) => value + 1)}>Réessayer</button></p>}{page.hasMore && <button className="button ghost" disabled={loading} onClick={() => void more()}>Charger plus d’exemplaires</button>}</details>
  </article>
}
