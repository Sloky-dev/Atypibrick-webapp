import { useEffect, useMemo, useState } from 'react'
import { Box, ExternalLink, LoaderCircle, PackagePlus, RefreshCw, Trash2, X } from 'lucide-react'
import { missingPartsApi } from '../api'
import type { LegoSet, MissingPart, PickABrickPart } from '../types'

export function MissingPartsModal({ set, onClose }: { set: LegoSet; onClose: () => void }) {
  const [items, setItems] = useState<MissingPart[] | null>(null)
  const [reference, setReference] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [candidates, setCandidates] = useState<PickABrickPart[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [lookingUp, setLookingUp] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const selected = useMemo(() => candidates.find((item) => item.elementId === selectedId), [candidates, selectedId])

  useEffect(() => { missingPartsApi.list(set.id).then(setItems).catch((reason) => setError(reason instanceof Error ? reason.message : 'Chargement impossible')) }, [set.id])
  useEffect(() => {
    const value = reference.trim()
    if (!value) { setCandidates([]); setSelectedId(''); setLookingUp(false); return }
    let active = true; setLookingUp(true); setError('')
    const timer = window.setTimeout(async () => {
      try { const result = await missingPartsApi.lookup(value); if (active) { setCandidates(result); const exact = result.find((item) => item.elementId === value); setSelectedId(exact?.elementId || (result.length === 1 ? result[0].elementId : '')); if (!result.length) setError('Référence introuvable sur LEGO Pick a Brick') } }
      catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'Recherche impossible') }
      finally { if (active) setLookingUp(false) }
    }, 500)
    return () => { active = false; window.clearTimeout(timer) }
  }, [reference])

  const add = async () => {
    if (!selected) return
    setSaving(true); setError('')
    try { const item = await missingPartsApi.add(set.id, selected.elementId, quantity); setItems((current) => [item, ...(current || [])]); setReference(''); setQuantity(1); setCandidates([]); setSelectedId('') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Ajout impossible') }
    finally { setSaving(false) }
  }
  const refresh = async (id: string) => { setSaving(true); try { const updated = await missingPartsApi.refresh(id); setItems((current) => current?.map((item) => item.id === id ? updated : item) ?? []) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Actualisation impossible') } finally { setSaving(false) } }
  const remove = async (id: string) => { setSaving(true); try { await missingPartsApi.remove(id); setItems((current) => current?.filter((item) => item.id !== id) ?? []) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Suppression impossible') } finally { setSaving(false) } }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal missing-parts-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="eyebrow">#{set.setNumber}</span><h2>Pièces manquantes</h2><p className="modal-subtitle">{set.name}</p></div><button className="icon-button" onClick={onClose} aria-label="Fermer"><X /></button></div><div className="part-lookup"><label>Référence LEGO de la pièce<input autoFocus value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Ex. 300126" /></label><label>Quantité<input type="number" min="1" max="999" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} /></label></div>{lookingUp && <div className="part-lookup-status"><LoaderCircle /> Vérification chez LEGO Pick a Brick…</div>}{candidates.length > 0 && <div className="part-candidates">{candidates.map((part) => <button className={selectedId === part.elementId ? 'selected' : ''} onClick={() => setSelectedId(part.elementId)} key={part.elementId}><span>{part.imageUrl ? <img src={part.imageUrl} alt="" /> : <Box />}</span><div><small>ÉLÉMENT {part.elementId} · DESIGN {part.designId}</small><strong>{part.name}</strong><em className={part.inStock ? 'available' : 'unavailable'}>{part.inStock ? 'Disponible chez LEGO' : 'Indisponible actuellement'}{part.price ? ` · ${part.price} ${part.currency || 'EUR'}` : ''}</em></div></button>)}</div>}{selected && <button className="button primary part-add" disabled={saving} onClick={() => void add()}><PackagePlus /> Ajouter {quantity} pièce{quantity > 1 ? 's' : ''} manquante{quantity > 1 ? 's' : ''}</button>}{error && <p className="form-error">{error}</p>}<div className="missing-parts-list"><h3>Pièces enregistrées <span>{items?.reduce((total, item) => total + item.quantity, 0) || 0}</span></h3>{items === null && <div className="part-lookup-status"><LoaderCircle /> Chargement…</div>}{items?.length === 0 && <p className="parts-empty">Aucune pièce manquante pour ce set.</p>}{items?.map((item) => <article key={item.id}><span className="missing-part-image">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <Box />}</span><div><small>ÉLÉMENT {item.elementId} · × {item.quantity}</small><strong>{item.name}</strong><em className={item.inStock ? 'available' : 'unavailable'}>{item.inStock ? 'Disponible chez LEGO Pick a Brick' : 'Indisponible chez LEGO'} · vérifié le {new Date(item.availabilityCheckedAt).toLocaleDateString('fr-FR')}</em></div><div className="missing-part-actions"><a href={`https://www.lego.com/fr-fr/pick-and-build/pick-a-brick?query=${item.elementId}`} target="_blank" rel="noreferrer" title="Voir chez LEGO"><ExternalLink /></a><button disabled={saving} onClick={() => void refresh(item.id)} title="Actualiser"><RefreshCw /></button><button disabled={saving} onClick={() => void remove(item.id)} title="Retirer"><Trash2 /></button></div></article>)}</div><div className="modal-actions"><button className="button ghost" onClick={onClose}>Fermer</button></div></section></div>
}
