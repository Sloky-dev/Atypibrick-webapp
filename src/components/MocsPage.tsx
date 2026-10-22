import { useEffect, useRef, useState } from 'react'
import { Download, FileText, Pencil, Plus, Search, Shapes, Trash2, X } from 'lucide-react'
import { MAX_NOTICE_BYTES, mocsApi } from '../mocs'
import type { Moc, MocBaseSet, MocInput } from '../mocs'
import './mocs.css'

const message = (reason: unknown) => reason instanceof Error ? reason.message : 'Une erreur est survenue. Réessayez.'

function MocForm({ item, onClose, onSaved }: { item: Moc | null; onClose: () => void; onSaved: (item: Moc) => void }) {
  const [form, setForm] = useState<MocInput>({ name: item?.name || '', baseSetId: item?.baseSetId || null, builtAt: item?.builtAt || null, notes: item?.notes || '', removeInstruction: false })
  const [notice, setNotice] = useState<File | null>(null)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<MocBaseSet[]>([])
  const [chosen, setChosen] = useState<MocBaseSet | null>(item?.baseSetId ? { id: item.baseSetId, name: item.baseSetName, brand: item.baseSetBrand, setNumber: item.baseSetNumber } : null)
  const [searchError, setSearchError] = useState('')
  const [searching, setSearching] = useState(true)
  const [retry, setRetry] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const pending = useRef(false)
  useEffect(() => {
    let active = true
    setSearching(true); setSearchError('')
    const timer = window.setTimeout(() => {
      mocsApi.baseSets(query).then((sets) => { if (active) setOptions(sets) })
        .catch((reason) => { if (active) setSearchError(message(reason)) })
        .finally(() => { if (active) setSearching(false) })
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [query, retry])
  const choices = chosen && !options.some((option) => option.id === chosen.id) ? [chosen, ...options] : options
  return <div className="modal-backdrop"><form className="modal moc-form" role="dialog" aria-modal="true" aria-labelledby="moc-form-title" onSubmit={async (event) => {
    event.preventDefault()
    if (pending.current) return
    pending.current = true; setSaving(true); setError('')
    try { onSaved(await mocsApi.save(item?.id || null, form, notice)) }
    catch (reason) { setError(message(reason)) }
    finally { pending.current = false; setSaving(false) }
  }}>
    <div className="modal-head"><div><span className="eyebrow">MA CONSTRUCTION</span><h2 id="moc-form-title">{item ? 'Modifier le MOC' : 'Ajouter un MOC'}</h2></div><button type="button" className="icon-button" disabled={saving} onClick={onClose} aria-label="Fermer"><X /></button></div>
    <div className="form-grid">
      <label className="full">Nom du MOC<input autoFocus required maxLength={220} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex. Le château de la forêt" /></label>
      <label className="full">Rechercher un set de base<input type="search" maxLength={120} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom ou numéro d’un set de ma collection" /></label>
      <label className="full">Set de base<select aria-label="Set de base" required={!item || item.baseSetId !== null} value={form.baseSetId || ''} onChange={(event) => {
        const selected = choices.find((option) => option.id === event.target.value) || null
        setChosen(selected); setForm({ ...form, baseSetId: selected?.id || null })
      }}><option value="">{item && !item.baseSetId ? `${item.baseSetBrand} · #${item.baseSetNumber} · ${item.baseSetName} (retiré de la collection)` : 'Choisir un set de ma collection'}</option>{choices.map((option) => <option key={option.id} value={option.id}>{option.brand} · #{option.setNumber} · {option.name}</option>)}</select></label>
      <div className="moc-form-help">{searching ? 'Recherche des sets…' : searchError ? <span role="alert">{searchError} <button type="button" onClick={() => setRetry((value) => value + 1)}>Réessayer</button></span> : !options.length ? 'Aucun set trouvé. Ajoutez un set à votre collection ou modifiez la recherche.' : 'Recherchez par nom ou numéro pour retrouver un autre set (50 résultats maximum).'}<p>Le set reste dans votre collection. Le MOC n’ajoute aucun montant investi.</p></div>
      <label>Date de construction<input type="date" value={form.builtAt || ''} onChange={(event) => setForm({ ...form, builtAt: event.target.value || null })} /></label>
      <label className="full">Notice PDF (facultative, 50 Mo maximum)<input type="file" accept="application/pdf,.pdf" onChange={(event) => {
        const file = event.target.files?.[0] || null
        setError('')
        if (file && (file.size > MAX_NOTICE_BYTES || !file.name.toLowerCase().endsWith('.pdf'))) {
          setError('Choisissez une notice PDF de 50 Mo maximum.'); event.target.value = ''; setNotice(null); return
        }
        setNotice(file)
        if (file) setForm({ ...form, removeInstruction: false })
      }} /></label>
      {item?.instructionName && <div className="moc-existing-file"><FileText size={18} /><span>{item.instructionName}</span><label><input type="checkbox" disabled={!!notice} checked={form.removeInstruction} onChange={(event) => setForm({ ...form, removeInstruction: event.target.checked })} /> Retirer la notice</label></div>}
      <label className="full">Notes<textarea aria-label="Notes" rows={3} maxLength={4000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Créateur, référence du MOC, adaptations…" /></label>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-actions"><button type="button" className="button ghost" disabled={saving} onClick={onClose}>Annuler</button><button className="button primary" disabled={saving || !form.name.trim() || (!item && !form.baseSetId)}>{saving ? 'Enregistrement…' : 'Enregistrer le MOC'}</button></div>
  </form></div>
}

export default function MocsPage() {
  const [items, setItems] = useState<Moc[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [retry, setRetry] = useState(0)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Moc | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const pending = useRef(false)
  useEffect(() => {
    let active = true
    setLoading(true); setLoadError('')
    mocsApi.list().then((result) => { if (active) setItems(result) })
      .catch((reason) => { if (active) setLoadError(message(reason)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [retry])
  const download = async (item: Moc) => {
    if (pending.current) return
    pending.current = true; setBusy(item.id); setError('')
    try {
      const blob = await mocsApi.download(item.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = item.instructionName || 'notice.pdf'
      document.body.append(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (reason) { setError(message(reason)) }
    finally { pending.current = false; setBusy(null) }
  }
  const remove = async (item: Moc) => {
    if (pending.current || !window.confirm(`Supprimer « ${item.name} » et sa notice ? Le set de base sera conservé.`)) return
    pending.current = true; setBusy(item.id); setError(''); setStatus('')
    try { await mocsApi.remove(item.id); setItems((current) => current.filter((entry) => entry.id !== item.id)); setStatus('MOC supprimé. Le set de base est conservé.') }
    catch (reason) { setError(message(reason)) }
    finally { pending.current = false; setBusy(null) }
  }
  const filtered = items.filter((item) => `${item.name} ${item.baseSetName} ${item.baseSetNumber}`.toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr')))
  return <section className="mocs-page">
    <div className="mocs-heading"><div><span className="eyebrow">MES CONSTRUCTIONS</span><h1>MOCs<span>.</span></h1><p>Une autre idée, les mêmes briques. Retrouvez vos créations, leurs sets de base et leurs notices.</p></div><button className="button primary" onClick={() => { setEditing(null); setFormOpen(true) }}><Plus /> Ajouter un MOC</button></div>
    <div className="mocs-toolbar"><span>{items.length} MOC{items.length > 1 ? 's' : ''} construit{items.length > 1 ? 's' : ''}</span><div className="search"><Search size={18} /><input aria-label="Rechercher un MOC" placeholder="MOC ou set de base…" value={query} onChange={(event) => setQuery(event.target.value)} /></div></div>
    {status && <p role="status" className="moc-status">{status}</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {loadError ? <div className="empty error" role="alert"><p>{loadError}</p><button onClick={() => setRetry((value) => value + 1)}>Réessayer</button></div> : loading ? <div className="empty"><div className="loader" /><p>Chargement des MOCs…</p></div> : !filtered.length ? <div className="empty"><span className="empty-icon"><Shapes /></span><h3>{query ? 'Aucun MOC trouvé' : 'Vos briques ont plus d’une histoire'}</h3><p>{query ? 'Essayez un autre nom ou numéro de set.' : 'Ajoutez votre première construction et gardez sa notice à portée de main.'}</p></div> : <div className="moc-grid">{filtered.map((item) => <article className="moc-card" key={item.id}>
      <div className="moc-card-top"><Shapes /><span>MOC</span>{item.builtAt && <time dateTime={item.builtAt}>{new Date(`${item.builtAt}T12:00:00`).toLocaleDateString('fr-FR')}</time>}</div>
      <h2>{item.name}</h2><div className="moc-base"><small>SET DE BASE · {item.baseSetBrand}</small><strong>#{item.baseSetNumber} · {item.baseSetName}</strong>{!item.baseSetId && <span>Retiré de la collection</span>}</div>
      {item.notes && <p className="moc-notes">{item.notes}</p>}
      <div className="moc-notice">{item.instructionName ? <button className="button ghost" disabled={!!busy} onClick={() => void download(item)}><Download size={17} /> {busy === item.id ? 'Patientez…' : 'Télécharger la notice'}</button> : <span><FileText size={17} /> Aucune notice</span>}</div>
      <div className="moc-actions"><button disabled={!!busy} onClick={() => { setEditing(item); setFormOpen(true) }}><Pencil size={16} /> Modifier</button><button disabled={!!busy} onClick={() => void remove(item)} aria-label={`Supprimer ${item.name}`}><Trash2 size={16} /> Supprimer</button></div>
    </article>)}</div>}
    {formOpen && <MocForm item={editing} onClose={() => setFormOpen(false)} onSaved={(item) => { setItems((current) => editing ? current.map((entry) => entry.id === item.id ? item : entry) : [item, ...current]); setFormOpen(false); setError(''); setStatus(editing ? 'MOC mis à jour.' : 'MOC ajouté.'); setQuery('') }} />}
  </section>
}
