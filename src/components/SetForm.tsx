import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { LegoSet, LegoSetPayload } from '../types'

const emptyForm: LegoSetPayload = { setNumber: '', name: '', theme: '', purchaseDate: null, purchasePrice: '0', quantity: 1, condition: 'Neuf', imageUrl: '', notes: '' }

type Props = { item: LegoSet | null; onClose: () => void; onSubmit: (payload: LegoSetPayload) => Promise<void> }

export function SetForm({ item, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<LegoSetPayload>(emptyForm)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setForm(item ? { setNumber: item.setNumber, name: item.name, theme: item.theme, purchaseDate: item.purchaseDate, purchasePrice: item.purchasePrice, quantity: item.quantity, condition: item.condition, imageUrl: item.imageUrl, notes: item.notes } : emptyForm) }, [item])
  const update = (key: keyof LegoSetPayload, value: string | number | null) => setForm((current) => ({ ...current, [key]: value }))

  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <form className="modal" onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSubmit(form) } finally { setSaving(false) } }}>
      <div className="modal-head"><div><span className="eyebrow">INVENTAIRE</span><h2>{item ? 'Modifier le set' : 'Ajouter un set'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer"><X /></button></div>
      <div className="form-grid">
        <label>Numéro du set<input required autoFocus placeholder="Ex. 10316" value={form.setNumber} onChange={(e) => update('setNumber', e.target.value)} /></label>
        <label>Nom du set<input required minLength={2} placeholder="Le Seigneur des Anneaux : Fondcombe" value={form.name} onChange={(e) => update('name', e.target.value)} /></label>
        <label>Thème<input placeholder="Icons, Star Wars…" value={form.theme || ''} onChange={(e) => update('theme', e.target.value)} /></label>
        <label>État<select value={form.condition} onChange={(e) => update('condition', e.target.value)}><option>Neuf</option><option>Occasion</option><option>Scellé</option><option>Incomplet</option></select></label>
        <label>Prix unitaire (€)<input required min="0" step="0.01" type="number" value={form.purchasePrice} onChange={(e) => update('purchasePrice', e.target.value)} /></label>
        <label>Quantité<input required min="1" max="999" type="number" value={form.quantity} onChange={(e) => update('quantity', Number(e.target.value))} /></label>
        <label>Date d'achat<input type="date" value={form.purchaseDate || ''} onChange={(e) => update('purchaseDate', e.target.value || null)} /></label>
        <label>URL de l'image<input type="url" placeholder="https://…" value={form.imageUrl || ''} onChange={(e) => update('imageUrl', e.target.value)} /></label>
        <label className="full">Notes<textarea rows={3} placeholder="Lieu d'achat, état de la boîte…" value={form.notes} onChange={(e) => update('notes', e.target.value)} /></label>
      </div>
      <div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>Annuler</button><button className="button primary" disabled={saving}>{saving ? 'Enregistrement…' : item ? 'Enregistrer' : 'Ajouter à ma collection'}</button></div>
    </form>
  </div>
}
