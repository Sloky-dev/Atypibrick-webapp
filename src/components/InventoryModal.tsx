import { useMemo, useState } from 'react'
import { Box, Check, ClipboardCheck, Trash2, X } from 'lucide-react'
import type { LegoSet } from '../types'

type Props = { items: LegoSet[]; onClose: () => void; onDeleteMissing: (ids: string[]) => Promise<void> }

export function InventoryModal({ items, onClose, onDeleteMissing }: Props) {
  const [presentIds, setPresentIds] = useState<Set<string>>(() => new Set())
  const [reviewing, setReviewing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const missing = useMemo(() => items.filter((item) => !presentIds.has(item.id)), [items, presentIds])

  const toggle = (id: string) => setPresentIds((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const deleteMissing = async () => {
    setDeleting(true); setError('')
    try { await onDeleteMissing(missing.map((item) => item.id)); onClose() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'La suppression a échoué') }
    finally { setDeleting(false) }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="modal inventory-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-title">
      <div className="modal-head"><div><span className="eyebrow">CONTRÔLE DE COLLECTION</span><h2 id="inventory-title">Faire l’inventaire</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer"><X /></button></div>
      {!reviewing ? <>
        <div className="inventory-intro"><ClipboardCheck /><div><strong>Vérifiez chaque exemplaire</strong><p>Cochez « Présent » lorsque vous avez retrouvé physiquement le set. Les exemplaires identiques sont contrôlés séparément.</p></div></div>
        <div className="inventory-progress"><span>{presentIds.size} sur {items.length} vérifiés</span><button type="button" onClick={() => setPresentIds(new Set(items.map((item) => item.id)))}>Tout marquer présent</button></div>
        <div className="inventory-list">{items.map((item) => <label className={`inventory-row ${presentIds.has(item.id) ? 'checked' : ''}`} key={item.id}>
          <span className="inventory-thumb">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <Box />}</span>
          <span className="inventory-details"><small>#{item.setNumber} · {item.condition}</small><strong>{item.name}</strong><em>{item.purchaseDate ? `Acheté le ${new Date(`${item.purchaseDate}T00:00:00`).toLocaleDateString('fr-FR')}` : 'Date d’achat inconnue'}</em></span>
          <input type="checkbox" checked={presentIds.has(item.id)} onChange={() => toggle(item.id)} /><span className="inventory-check"><Check /></span><b>Présent</b>
        </label>)}</div>
        <div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>Annuler</button><button type="button" className="button primary" disabled={items.length === 0} onClick={() => setReviewing(true)}>Terminer l’inventaire</button></div>
      </> : <>
        {missing.length === 0 ? <div className="inventory-complete"><span><Check /></span><h3>Collection complète</h3><p>Tous les sets ont été retrouvés. Aucun élément ne sera supprimé.</p></div> : <><div className="inventory-warning"><Trash2 /><div><strong>{missing.length} set{missing.length > 1 ? 's' : ''} non retrouvé{missing.length > 1 ? 's' : ''}</strong><p>Vérifiez cette liste avant de les supprimer définitivement de votre collection.</p></div></div><div className="inventory-missing-list">{missing.map((item) => <div key={item.id}><span>#{item.setNumber}</span><strong>{item.name}</strong></div>)}</div></>}
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions"><button type="button" className="button ghost" disabled={deleting} onClick={() => setReviewing(false)}>Retour à la vérification</button>{missing.length === 0 ? <button type="button" className="button primary" onClick={onClose}>Terminer</button> : <button type="button" className="button danger-button" disabled={deleting} onClick={() => void deleteMissing()}>{deleting ? 'Suppression…' : `Supprimer ${missing.length} set${missing.length > 1 ? 's' : ''}`}</button>}</div>
      </>}
    </section>
  </div>
}
