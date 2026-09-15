import { useEffect, useMemo, useState } from 'react'
import { Box, CheckCheck, ExternalLink, LoaderCircle, PackagePlus, RefreshCw, Trash2, X } from 'lucide-react'
import { missingPartsApi } from '../api'
import type { LegoSet, MissingPart, PickABrickPart } from '../types'

type Props = { set: LegoSet; onClose: () => void; onChange: (count: number, addedInvestment?: number) => void }

const missingCount = (items: MissingPart[]) => items.filter((item) => item.status === 'missing').reduce((total, item) => total + item.quantity, 0)

export function MissingPartsModal({ set, onClose, onChange }: Props) {
  const [items, setItems] = useState<MissingPart[] | null>(null)
  const [reference, setReference] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [candidates, setCandidates] = useState<PickABrickPart[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [lookingUp, setLookingUp] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [replacementItem, setReplacementItem] = useState<MissingPart | null>(null)
  const [replacementPrice, setReplacementPrice] = useState('0')
  const [replacementError, setReplacementError] = useState('')
  const selected = useMemo(() => candidates.find((item) => item.elementId === selectedId), [candidates, selectedId])

  useEffect(() => { missingPartsApi.list(set.id).then(setItems).catch((reason) => setError(reason instanceof Error ? reason.message : 'Chargement impossible')) }, [set.id])
  useEffect(() => {
    const value = reference.trim()
    if (!value) { setCandidates([]); setSelectedId(''); setLookingUp(false); return }
    let active = true
    setLookingUp(true); setError('')
    const timer = window.setTimeout(async () => {
      try {
        const result = await missingPartsApi.lookup(value)
        if (active) {
          setCandidates(result)
          const exact = result.find((item) => item.elementId === value)
          setSelectedId(exact?.elementId || (result.length === 1 ? result[0].elementId : ''))
          if (!result.length) setError('Référence introuvable sur LEGO Pick a Brick')
        }
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'Recherche impossible') }
      finally { if (active) setLookingUp(false) }
    }, 500)
    return () => { active = false; window.clearTimeout(timer) }
  }, [reference])

  const add = async () => {
    if (!selected) return
    setSaving(true); setError('')
    try {
      const item = await missingPartsApi.add(set.id, selected.elementId, quantity)
      setItems((current) => { const next = [item, ...(current || [])]; onChange(missingCount(next)); return next })
      setReference(''); setQuantity(1); setCandidates([]); setSelectedId('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ajout impossible') }
    finally { setSaving(false) }
  }
  const refresh = async (id: string) => {
    setSaving(true)
    try { const updated = await missingPartsApi.refresh(id); setItems((current) => current?.map((item) => item.id === id ? updated : item) ?? []) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Actualisation impossible') }
    finally { setSaving(false) }
  }
  const replace = async () => {
    if (!replacementItem) return
    const price = Number(replacementPrice.replace(',', '.'))
    if (!Number.isFinite(price) || price < 0) { setReplacementError('Saisissez un prix valide.'); return }
    setSaving(true); setReplacementError('')
    try {
      const updated = await missingPartsApi.replace(replacementItem.id, price)
      setItems((current) => {
        const next = current?.map((entry) => entry.id === replacementItem.id ? updated : entry) ?? []
        onChange(missingCount(next), price)
        return next
      })
      setReplacementItem(null)
    } catch (reason) { setReplacementError(reason instanceof Error ? reason.message : 'Remplacement impossible') }
    finally { setSaving(false) }
  }
  const remove = async (id: string) => {
    setSaving(true)
    try {
      await missingPartsApi.remove(id)
      setItems((current) => { const next = current?.filter((item) => item.id !== id) ?? []; onChange(missingCount(next)); return next })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Suppression impossible') }
    finally { setSaving(false) }
  }

  return <><div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal missing-parts-modal" role="dialog" aria-modal="true">
    <div className="modal-head"><div><span className="eyebrow">#{set.setNumber}</span><h2>Pièces manquantes</h2><p className="modal-subtitle">{set.name}</p></div><button className="icon-button" onClick={onClose} aria-label="Fermer"><X /></button></div>
    <div className="part-lookup"><label>Référence LEGO de la pièce<input autoFocus value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Ex. 300126" /></label><label>Quantité<input type="number" min="1" max="999" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} /></label></div>
    {lookingUp && <div className="part-lookup-status"><LoaderCircle /> Vérification chez LEGO Pick a Brick…</div>}
    {candidates.length > 0 && <div className="part-candidates">{candidates.map((part) => <button className={selectedId === part.elementId ? 'selected' : ''} onClick={() => setSelectedId(part.elementId)} key={part.elementId}><span>{part.imageUrl ? <img src={part.imageUrl} alt="" /> : <Box />}</span><div><small>ÉLÉMENT {part.elementId} · DESIGN {part.designId}</small><strong>{part.name}</strong><em className={part.inStock ? 'available' : 'unavailable'}>{part.inStock ? 'Disponible chez LEGO' : 'Indisponible actuellement'}{part.price ? ` · ${part.price} ${part.currency || 'EUR'}` : ''}</em></div></button>)}</div>}
    {selected && <button className="button primary part-add" disabled={saving} onClick={() => void add()}><PackagePlus /> Ajouter {quantity} pièce{quantity > 1 ? 's' : ''} manquante{quantity > 1 ? 's' : ''}</button>}
    {error && <p className="form-error">{error}</p>}
    <div className="missing-parts-list"><h3>Suivi des pièces <span>{items ? missingCount(items) : 0} manquante{items && missingCount(items) > 1 ? 's' : ''}</span></h3>
      {items === null && <div className="part-lookup-status"><LoaderCircle /> Chargement…</div>}
      {items?.length === 0 && <p className="parts-empty">Aucune pièce enregistrée pour ce set.</p>}
      {items?.map((item) => <article className={item.status === 'replaced' ? 'replaced' : ''} key={item.id}><span className="missing-part-image">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <Box />}</span><div><small>ÉLÉMENT {item.elementId} · × {item.quantity}</small><strong>{item.name}</strong>{item.status === 'missing' ? <em className={item.inStock ? 'available' : 'unavailable'}>{item.inStock ? 'Disponible chez LEGO Pick a Brick' : 'Indisponible chez LEGO'} · vérifié le {new Date(item.availabilityCheckedAt).toLocaleDateString('fr-FR')}</em> : <em className="available">Remplacée le {item.replacedAt ? new Date(item.replacedAt).toLocaleDateString('fr-FR') : ''} · {Number(item.replacementPrice || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</em>}</div><div className="missing-part-actions">{item.status === 'missing' && <><a href={`https://www.lego.com/fr-fr/pick-and-build/pick-a-brick?query=${item.elementId}`} target="_blank" rel="noreferrer" title="Voir chez LEGO"><ExternalLink /></a><button disabled={saving} onClick={() => void refresh(item.id)} title="Actualiser"><RefreshCw /></button><button disabled={saving} onClick={() => { setReplacementItem(item); setReplacementPrice('0'); setReplacementError('') }} title="Marquer comme remplacée"><CheckCheck /></button><button disabled={saving} onClick={() => void remove(item.id)} title="Retirer"><Trash2 /></button></>}</div></article>)}
    </div>
    <div className="modal-actions"><button className="button ghost" onClick={onClose}>Fermer</button></div>
  </section></div>{replacementItem && <div className="replacement-price-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setReplacementItem(null)}><form className="replacement-price-modal" role="dialog" aria-modal="true" aria-labelledby="replacement-price-title" onSubmit={(event) => { event.preventDefault(); void replace() }}><div className="replacement-price-head"><div><span>PIÈCE REMPLACÉE</span><h3 id="replacement-price-title">Renseigner le coût</h3></div><button type="button" onClick={() => setReplacementItem(null)} aria-label="Fermer"><X /></button></div><div className="replacement-part-summary"><span>{replacementItem.imageUrl ? <img src={replacementItem.imageUrl} alt="" /> : <Box />}</span><div><small>ÉLÉMENT {replacementItem.elementId} · × {replacementItem.quantity}</small><strong>{replacementItem.name}</strong></div></div><label>Prix total payé (€)<input autoFocus required type="number" min="0" step="0.01" value={replacementPrice} onChange={(event) => { setReplacementPrice(event.target.value); setReplacementError('') }} /></label>{replacementError && <p className="form-error">{replacementError}</p>}<p>Ce montant sera ajouté à l’investissement total du set.</p><div className="modal-actions"><button type="button" className="button ghost" onClick={() => setReplacementItem(null)}>Annuler</button><button className="button primary" disabled={saving}><CheckCheck /> {saving ? 'Enregistrement…' : 'Confirmer le remplacement'}</button></div></form></div>}</>
}
