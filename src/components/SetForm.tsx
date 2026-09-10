import { useEffect, useState } from 'react'
import { Check, LoaderCircle, X } from 'lucide-react'
import { legoSetApi } from '../api'
import type { LegoSet, LegoSetNameLookup, LegoSetPayload } from '../types'

const emptyForm: LegoSetPayload = { setNumber: '', purchaseDate: null, purchasePrice: '0', isGift: false, condition: 'Neuf', notes: '' }

type Props = { item: LegoSet | null; onClose: () => void; onSubmit: (payload: LegoSetPayload) => Promise<void> }

export function SetForm({ item, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<LegoSetPayload>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [resolvedSet, setResolvedSet] = useState<LegoSetNameLookup | null>(null)
  const [lookupError, setLookupError] = useState('')
  const [lookingUp, setLookingUp] = useState(false)
  useEffect(() => { setForm(item ? { setNumber: item.setNumber, purchaseDate: item.purchaseDate, purchasePrice: item.purchasePrice, isGift: item.isGift, condition: item.condition, notes: item.notes } : emptyForm); setResolvedSet(item ? { setNumber: item.setNumber, name: item.name, theme: item.theme, numParts: item.numParts, imageUrl: item.imageUrl } : null) }, [item])
  useEffect(() => {
    const reference = form.setNumber.trim()
    const normalize = (value: string) => value.toLowerCase().replace(/-1$/, '')
    if (!reference) { setResolvedSet(null); setLookupError(''); setLookingUp(false); return }
    if (item && normalize(reference) === normalize(item.setNumber)) { setResolvedSet({ setNumber: item.setNumber, name: item.name, theme: item.theme, numParts: item.numParts, imageUrl: item.imageUrl }); setLookupError(''); setLookingUp(false); return }
    setResolvedSet(null); setLookupError(''); setLookingUp(true)
    let active = true
    const timer = window.setTimeout(async () => {
      try {
        const result = await legoSetApi.lookup(reference)
        if (active) { setResolvedSet(result); setForm((current) => ({ ...current, setNumber: result.setNumber })) }
      } catch (reason) {
        if (active) setLookupError(reason instanceof Error ? reason.message : 'Référence introuvable')
      } finally {
        if (active) setLookingUp(false)
      }
    }, 550)
    return () => { active = false; window.clearTimeout(timer) }
  }, [form.setNumber, item])
  const update = (key: keyof LegoSetPayload, value: string | number | null) => setForm((current) => ({ ...current, [key]: value }))

  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <form className="modal" onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSubmit(form) } finally { setSaving(false) } }}>
      <div className="modal-head"><div><span className="eyebrow">INVENTAIRE</span><h2>{item ? 'Modifier le set' : 'Ajouter un set'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer"><X /></button></div>
      <div className="form-grid">
        <label>Numéro du set<input required autoFocus placeholder="Ex. 10316" value={form.setNumber} onChange={(e) => update('setNumber', e.target.value)} /></label>
        <label>Set identifié<div className={`resolved-set ${lookupError ? 'invalid' : resolvedSet ? 'valid' : ''}`}>{lookingUp ? <><LoaderCircle className="lookup-spinner" /> Recherche…</> : resolvedSet ? <><Check /> {resolvedSet.name}</> : lookupError || 'Saisissez une référence LEGO valide'}</div></label>
        {resolvedSet && <div className="lookup-preview full"><div className="lookup-image">{resolvedSet.imageUrl ? <img src={resolvedSet.imageUrl} alt={`Boîte du set ${resolvedSet.setNumber}`} /> : <span>Image indisponible</span>}</div><div><small>INFORMATIONS DU SET</small><strong>{resolvedSet.name}</strong><p>{resolvedSet.theme || 'Thème non renseigné'}{resolvedSet.numParts ? ` · ${resolvedSet.numParts.toLocaleString('fr-FR')} pièces` : ''}</p></div></div>}
        <label>État<select value={form.condition} onChange={(e) => update('condition', e.target.value)}><option>Neuf</option><option>Occasion</option><option>Scellé</option><option>Incomplet</option></select></label>
        <label>Prix d'achat (€)<input required min="0" step="0.01" type="number" disabled={form.isGift} value={form.purchasePrice} onChange={(e) => update('purchasePrice', e.target.value)} /></label>
        <label className="gift-option"><input type="checkbox" checked={form.isGift} onChange={(e) => setForm((current) => ({ ...current, isGift: e.target.checked, purchasePrice: e.target.checked ? '0' : current.purchasePrice }))} /><span><strong>Cadeau</strong><small>Ce set ne compte pas dans le montant investi.</small></span></label>
        <label>Date d'achat<input type="date" value={form.purchaseDate || ''} onChange={(e) => update('purchaseDate', e.target.value || null)} /></label>
        <label className="full">Notes<textarea rows={3} placeholder="Lieu d'achat, état de la boîte…" value={form.notes} onChange={(e) => update('notes', e.target.value)} /></label>
      </div>
      <div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>Annuler</button><button className="button primary" disabled={saving || lookingUp || !resolvedSet}>{saving ? 'Enregistrement…' : item ? 'Enregistrer' : 'Ajouter à ma collection'}</button></div>
    </form>
  </div>
}
