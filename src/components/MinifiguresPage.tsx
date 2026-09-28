import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, UserRound, X } from 'lucide-react'
import { collectionApi } from '../api'
import type { LegoSet } from '../types'
import { minifigureApi, type MiniCollection, type MiniCopy, type MiniCopyInput, type MiniSeries, type MiniSeriesInput } from '../minifigures'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const reasonText = (reason: unknown) => reason instanceof Error ? reason.message : 'L’action a échoué. Réessayez.'
const blankCopy = (seriesId: string, characterId: string | null): MiniCopyInput => ({ seriesId, characterId, purchasePrice: '0', purchaseDate: null, condition: 'Neuf', sealed: !characterId, accessoriesComplete: true, isGift: false, sourceSetId: null, includedInSet: false, notes: '' })

function CopyForm({ series, initial, id, onClose, onSave }: { series: MiniSeries; initial: MiniCopyInput; id?: string; onClose: () => void; onSave: () => Promise<void> }) {
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [setQuery, setSetQuery] = useState('')
  const [sourceSets, setSourceSets] = useState<LegoSet[]>([])
  const [sourceError, setSourceError] = useState('')
  useEffect(() => {
    if (!form.includedInSet) return
    let active = true
    const timer = window.setTimeout(() => { setSourceError(''); void collectionApi.list(setQuery, null, 20).then((page) => { if (active) setSourceSets(page.items) }).catch((reason) => { if (active) setSourceError(reasonText(reason)) }) }, 300)
    return () => { active = false; window.clearTimeout(timer) }
  }, [setQuery, form.includedInSet])
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('')
    try { await minifigureApi.save(form, id); await onSave() } catch (reason) { setError(reasonText(reason)) } finally { setBusy(false) }
  }
  return <div className="modal-backdrop"><form className="modal mini-form" role="dialog" aria-modal="true" aria-label={id ? 'Modifier la minifigurine' : 'Ajouter une minifigurine'} onSubmit={submit}>
    <div className="modal-head"><div><span className="eyebrow">{series.name}</span><h2>{id ? 'Mon exemplaire' : 'Ajouter une minifigurine'}</h2></div><button type="button" className="icon-button" disabled={busy} aria-label="Fermer" onClick={onClose}><X /></button></div>
    <div className="form-grid">
      <label>Personnage<select value={form.characterId || ''} onChange={(event) => setForm({ ...form, characterId: event.target.value || null, sealed: !event.target.value || form.sealed })}><option value="">Personnage inconnu — boîte scellée</option>{series.characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select></label>
      <label>État<select value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value as 'Neuf' | 'Occasion' })}><option>Neuf</option><option>Occasion</option></select></label>
      <label>Prix d’achat (€)<input type="number" required min="0" max="99999999.99" step="0.01" disabled={form.isGift || form.includedInSet} value={form.purchasePrice} onChange={(event) => setForm({ ...form, purchasePrice: event.target.value })} /></label>
      <label>Date d’achat<input type="date" value={form.purchaseDate || ''} onChange={(event) => setForm({ ...form, purchaseDate: event.target.value || null })} /></label>
      <label className="mini-check"><input type="checkbox" checked={form.sealed} disabled={!form.characterId} onChange={(event) => setForm({ ...form, sealed: event.target.checked })} /> Boîte scellée</label>
      <label className="mini-check"><input type="checkbox" checked={form.accessoriesComplete} onChange={(event) => setForm({ ...form, accessoriesComplete: event.target.checked })} /> Accessoires complets</label>
      <label className="mini-check"><input type="checkbox" checked={form.isGift} onChange={(event) => setForm({ ...form, isGift: event.target.checked, purchasePrice: event.target.checked ? '0' : form.purchasePrice })} /> Cadeau</label>
      <label className="mini-check"><input type="checkbox" checked={form.includedInSet} onChange={(event) => setForm({ ...form, includedInSet: event.target.checked, sourceSetId: event.target.checked ? form.sourceSetId : null, purchasePrice: event.target.checked ? '0' : form.purchasePrice })} /> Incluse dans un set</label>
      {form.includedInSet && <div className="full"><p className="mini-hint">Le prix reste inclus dans celui du set. Aucun montant supplémentaire n’est comptabilisé.</p><label>Rechercher le set d’origine<input value={setQuery} onChange={(event) => setSetQuery(event.target.value)} placeholder="Nom ou numéro du set" /></label><label>Set d’origine (facultatif)<select value={form.sourceSetId || ''} onChange={(event) => setForm({ ...form, sourceSetId: event.target.value || null })}><option value="">Non renseigné</option>{form.sourceSetId && !sourceSets.some((item) => item.id === form.sourceSetId) && <option value={form.sourceSetId}>Set déjà associé</option>}{sourceSets.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.setNumber}</option>)}</select></label>{sourceError && <p role="alert">{sourceError}</p>}</div>}
      <label className="full">Notes / accessoires manquants<textarea maxLength={4000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-actions"><button type="button" className="button ghost" disabled={busy} onClick={onClose}>Annuler</button><button className="button primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button></div>
  </form></div>
}

export default function MinifiguresPage({ refreshVersion = 0 }: { refreshVersion?: number }) {
  const [data, setData] = useState<MiniCollection>({ series: [], copies: [] })
  const imageAttempts = useRef(new Set<string>())
  const [imagePending, setImagePending] = useState<string[]>([])
  const [imageError, setImageError] = useState('')
  const syncImages = useCallback(async (seriesId: string) => {
    setImagePending((current) => [...current, seriesId]); setImageError('')
    try {
      const updated = await minifigureApi.images(seriesId)
      setData((current) => ({ ...current, series: current.series.map((series) => series.id !== seriesId ? series : { ...series, characters: series.characters.map((character) => {
        const match = updated.characters.find((item) => item.id === character.id && item.name === character.name && (!character.catalogReference || character.catalogReference === item.catalogReference))
        return match ? { ...character, imageUrl: match.imageUrl, catalogReference: match.catalogReference } : character
      }) }) }))
      if (updated.characters.some((character) => character.catalogReference && !character.imageUrl)) setImageError('Certaines images sont indisponibles. Vous pouvez relancer leur récupération depuis la série.')
    } catch (reason) { setImageError(reasonText(reason)) }
    finally { setImagePending((current) => current.filter((id) => id !== seriesId)) }
  }, [])
  useEffect(() => {
    for (const series of data.series) {
      const missing = series.characters.filter((character) => !character.imageUrl && (character.catalogReference || series.reference === '71053'))
      const signature = `${series.id}:${missing.map((character) => `${character.id}:${character.catalogReference || character.name}`).join('|')}`
      if (series.brand.toLowerCase() === 'lego' && missing.length && !imageAttempts.current.has(signature) && !imagePending.includes(series.id)) {
        imageAttempts.current.add(signature); void syncImages(series.id)
      }
    }
  }, [data.series, imagePending, syncImages])
  const [catalog, setCatalog] = useState<MiniSeriesInput[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ message: string; undoId?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<'copies' | 'series'>('copies')
  const [tabFilters, setTabFilters] = useState({ copies: { search: '', selectedSeries: '', stateFilter: '' }, series: { search: '', selectedSeries: '', stateFilter: '' } })
  const { search, selectedSeries, stateFilter } = tabFilters[view]
  const updateFilter = (key: 'search' | 'selectedSeries' | 'stateFilter', value: string) => setTabFilters((current) => ({ ...current, [view]: { ...current[view], [key]: value } }))
  const setSearch = (value: string) => updateFilter('search', value)
  const setSelectedSeries = (value: string) => updateFilter('selectedSeries', value)
  const setStateFilter = (value: string) => updateFilter('stateFilter', value)
  const [addingSeries, setAddingSeries] = useState(false)
  const [seriesSearch, setSeriesSearch] = useState('')
  const [formError, setFormError] = useState('')
  const [editing, setEditing] = useState<{ series: MiniSeries; form: MiniCopyInput; id?: string } | null>(null)
  const load = useCallback(async () => {
    setError('')
    try { const result = await minifigureApi.list(); setData(result) }
    catch (reason) { setError(reasonText(reason)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load(); void minifigureApi.catalog().then(setCatalog).catch(() => setCatalog([])) }, [load, refreshVersion])
  useEffect(() => { if (!notice || busy) return; const timer = window.setTimeout(() => setNotice(null), notice.undoId ? 10000 : 5000); return () => window.clearTimeout(timer) }, [notice, busy])
  const openCopy = (series: MiniSeries, characterId: string | null, copy?: MiniCopy) => setEditing({ series, form: copy || blankCopy(series.id, characterId), id: copy?.id })
  const addSeries = async (payload: MiniSeriesInput) => {
    setBusy(true); setFormError('')
    try { const series = await minifigureApi.series(payload); await load(); setTabFilters((current) => ({ ...current, series: { search: '', selectedSeries: series.id, stateFilter: '' } })); setView('series'); setAddingSeries(false); setNotice({ message: 'Série ajoutée. Choisissez vos personnages.' }) }
    catch (reason) { setFormError(reasonText(reason)) } finally { setBusy(false) }
  }
  const remove = async (copy: MiniCopy) => {
    setBusy(true); setError('')
    try { await minifigureApi.remove(copy.id); await load(); setNotice({ message: 'Exemplaire placé dans la corbeille.', undoId: copy.id }) }
    catch (reason) { setError(reasonText(reason)) } finally { setBusy(false) }
  }
  const restore = async (id: string) => {
    setBusy(true); setError('')
    try { await minifigureApi.restore(id); await load(); setNotice({ message: 'Exemplaire restauré.' }) }
    catch (reason) { setError(reasonText(reason)) } finally { setBusy(false) }
  }
  const matchesSeries = (series: MiniSeries) => (!selectedSeries || selectedSeries === series.id) && `${series.name} ${series.reference || ''} ${series.brand} ${series.theme}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())
  const visibleSeries = data.series.filter(matchesSeries).filter((series) => {
    if (!stateFilter) return true
    const owned = new Set(data.copies.filter((copy) => copy.seriesId === series.id && copy.characterId).map((copy) => copy.characterId)).size
    const total = Math.max(series.expectedCount || 0, series.characters.length)
    return stateFilter === 'complete' ? total > 0 && owned >= total : total === 0 || owned < total
  })
  const groups = data.series.flatMap((series) => {
    if (selectedSeries && selectedSeries !== series.id) return []
    const entries = [...series.characters.map((character) => ({ id: character.id as string | null, name: character.name, imageUrl: character.imageUrl })), { id: null, name: 'Personnage inconnu — boîte scellée', imageUrl: null }]
    return entries.map((character) => ({ series, character, copies: data.copies.filter((copy) => copy.seriesId === series.id && copy.characterId === character.id) }))
  }).filter(({ series, character, copies }) => copies.length && `${series.name} ${series.reference || ''} ${series.theme} ${series.brand} ${character.name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()) && (!stateFilter || (stateFilter === 'duplicates' ? character.id !== null && copies.length > 1 : stateFilter === 'sealed' ? copies.some((copy) => copy.sealed) : copies.some((copy) => !copy.accessoriesComplete))))
  const unique = new Set(data.copies.filter((copy) => copy.characterId).map((copy) => copy.characterId)).size
  const identified = data.copies.filter((copy) => copy.characterId).length
  return <section className="minifigures-page">
    <div className="section-head"><div><span className="eyebrow">MA COLLECTION</span><h1>Minifigurines</h1><p>Vos personnages, vos séries et chaque exemplaire de votre collection.</p></div><button className="button primary" onClick={() => { setAddingSeries(true); setFormError('') }}><Plus /> Ajouter une série</button></div>
    <div className="mini-summary"><span><strong>{data.copies.length}</strong><small>EXEMPLAIRES</small></span><span><strong>{unique}</strong><small>PERSONNAGES</small></span><span><strong>{identified - unique}</strong><small>DOUBLONS</small></span><span><strong>{euro.format(data.copies.reduce((sum, copy) => sum + Number(copy.purchasePrice), 0))}</strong><small>INVESTIS EN FIGURINES</small></span></div>
    <div className="mini-tabs" role="tablist" aria-label="Collection de minifigurines">{([['copies', 'Mes figurines'], ['series', 'Mes séries']] as const).map(([key, label]) => <button type="button" role="tab" id={`mini-tab-${key}`} aria-controls={`mini-panel-${key}`} aria-selected={view === key} tabIndex={view === key ? 0 : -1} key={key} onClick={() => setView(key)} onKeyDown={(event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const next = event.key === 'Home' ? 'copies' : event.key === 'End' ? 'series' : view === 'copies' ? 'series' : 'copies'
      setView(next); document.getElementById(`mini-tab-${next}`)?.focus()
    }}>{label}</button>)}</div>
    <div role="tabpanel" id={`mini-panel-${view}`} aria-labelledby={`mini-tab-${view}`}>
    <div className="mini-toolbar"><label>Rechercher<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Personnage, série, numéro, univers…" /></label><label>Série<select value={selectedSeries} onChange={(event) => setSelectedSeries(event.target.value)}><option value="">Toutes les séries</option>{data.series.map((series) => <option key={series.id} value={series.id}>{series.name}</option>)}</select></label>{view === 'copies' && <label>Afficher<select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}><option value="">Tous les exemplaires</option><option value="duplicates">Doublons</option><option value="sealed">Boîtes scellées</option><option value="incomplete">Accessoires incomplets</option></select></label>}{view === 'series' && <label>Progression<select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}><option value="">Toutes les séries</option><option value="complete">Séries complètes</option><option value="incomplete">Séries à compléter</option></select></label>}{(search || selectedSeries || stateFilter) && <button className="button ghost" onClick={() => { setSearch(''); setSelectedSeries(''); setStateFilter('') }}>Effacer les filtres</button>}</div>
    {imagePending.length > 0 && <p role="status">Récupération des images du catalogue…</p>}
    {imageError && <p className="mini-hint" role="status">{imageError}</p>}
    {error && <div className="error" role="alert">{error}<button onClick={() => void load()}>Réessayer</button></div>}
    {loading && <p role="status">Chargement des minifigurines…</p>}
    {!loading && !data.series.length && !error && <div className="empty"><UserRound /><h3>Votre première série vous attend</h3><p>Recherchez Shrek ou 71053, dans le catalogue.</p><button className="button primary" onClick={() => { setAddingSeries(true); setFormError('') }}>Ajouter ma première série</button></div>}
    {view === 'series' && visibleSeries.map((series) => {
      const copies = data.copies.filter((copy) => copy.seriesId === series.id)
      const owned = new Set(copies.filter((copy) => copy.characterId).map((copy) => copy.characterId))
      const total = Math.max(series.expectedCount || 0, series.characters.length)
      const missing = series.characters.filter((character) => !owned.has(character.id))
      return <article className="mini-series" key={series.id}><div className="mini-series-head"><div><small>{series.brand} {series.reference ? `· #${series.reference}` : ''} · {series.theme}</small><h2>{series.name}</h2><p>{owned.size}/{total || '?'} personnages · {copies.length} exemplaires</p></div><button className="button" disabled={imagePending.includes(series.id)} onClick={() => void syncImages(series.id)}>Récupérer les images</button><button className="button" onClick={() => openCopy(series, null)}>Ajouter une boîte scellée</button></div><progress aria-label={`Progression ${series.name}`} max={total || 1} value={owned.size} /><p className="mini-hint">{missing.length ? `À trouver : ${missing.map((character) => character.name).join(', ')}` : total > owned.size ? 'Complétez la liste des personnages pour suivre ceux qui vous manquent.' : total ? 'Série complète !' : 'Ajoutez les personnages de cette série.'}</p><div className="mini-grid" role="region" aria-label={`Personnages de ${series.name}`} tabIndex={0}>{series.characters.map((character) => {
        const count = copies.filter((copy) => copy.characterId === character.id).length
        return <div className="mini-character-wrap" key={character.id}><button className={`mini-character ${count ? 'owned' : ''}`} key={character.id} onClick={() => openCopy(series, character.id)}><div className="mini-image">{character.imageUrl ? <img src={character.imageUrl} alt={character.name} loading="lazy" /> : <UserRound />}</div><strong>{character.name}</strong><span>{count ? `Possédée ×${count}` : 'Manquante'}</span><small>Ajouter un exemplaire</small></button></div>
      })}</div></article>
    })}
    {view === 'copies' && <><div className="mini-grid">{groups.map(({ series, character, copies }) => <article className="mini-owned-card" key={`${series.id}-${character.id}`}><div className="mini-image">{character.imageUrl ? <img src={character.imageUrl} alt={character.name} loading="lazy" /> : <UserRound />}</div><small>{series.name} {series.reference ? `· #${series.reference}` : ''}</small><h3>{character.name} <span>×{copies.length}</span></h3><button className="button ghost" onClick={() => openCopy(series, character.id)}><Plus /> Ajouter un exemplaire</button><details><summary>Voir les {copies.length} exemplaire{copies.length > 1 ? 's' : ''}</summary>{copies.map((copy) => <div className="mini-copy" key={copy.id}><p>{copy.condition} · {copy.includedInSet ? 'Incluse dans un set' : copy.isGift ? 'Cadeau' : euro.format(Number(copy.purchasePrice))}{copy.sealed ? ' · Scellée' : ''}{!copy.accessoriesComplete ? ' · Accessoires incomplets' : ''}</p>{copy.purchaseDate && <small>Achat : {new Date(`${copy.purchaseDate}T12:00:00`).toLocaleDateString('fr-FR')}</small>}{copy.notes && <p>{copy.notes}</p>}<div><button aria-label={`Modifier ${character.name}`} onClick={() => openCopy(series, copy.characterId, copy)}><Pencil size={16} /> {copy.characterId ? 'Modifier' : 'Identifier / modifier'}</button><button disabled={busy} aria-label={`Supprimer ${character.name}`} onClick={() => void remove(copy)}><Trash2 size={16} /></button></div></div>)}</details></article>)}</div>{!loading && data.series.length > 0 && !groups.length && <div className="empty"><p>Aucune figurine pour cette sélection.</p><button className="button" onClick={() => setView('series')}>Choisir des personnages dans mes séries</button></div>}</>}
    {view === 'series' && data.series.length > 0 && !visibleSeries.length && <p>Aucune série ne correspond à la recherche.</p>}
    </div>
    {notice && <div className="action-notices"><div className="action-notice"><span role="status">{notice.message}</span>{notice.undoId && <button disabled={busy} onClick={() => void restore(notice.undoId!)}>Annuler la suppression</button>}<button aria-label="Fermer la notification" onClick={() => setNotice(null)}><X size={16} /></button></div></div>}
    {addingSeries && <div className="modal-backdrop"><section className="modal mini-form" role="dialog" aria-modal="true" aria-label="Ajouter une série"><div className="modal-head"><h2>Ajouter une série</h2><button className="icon-button" disabled={busy} aria-label="Fermer" onClick={() => setAddingSeries(false)}><X /></button></div><label>Rechercher une série du catalogue<input value={seriesSearch} onChange={(event) => setSeriesSearch(event.target.value)} placeholder="Shrek, 71053…" /></label><div className="mini-catalog">{catalog.filter((series) => `${series.name} ${series.reference}`.toLocaleLowerCase().includes(seriesSearch.toLocaleLowerCase())).map((series) => <button className="button" key={`${series.brand}-${series.reference}`} disabled={busy} onClick={() => void addSeries(series)}>{series.name} · {series.reference} · {series.characters.length} personnages</button>)}</div><p className="mini-hint">La composition des séries provient du catalogue LEGO / BrickLink et ne peut pas être modifiée.</p>{formError && <p className="form-error" role="alert">{formError}</p>}</section></div>}
    {editing && <CopyForm series={editing.series} initial={editing.form} id={editing.id} onClose={() => setEditing(null)} onSave={async () => { setEditing(null); setNotice({ message: editing.id ? 'Exemplaire modifié.' : 'Minifigurine ajoutée à votre collection.' }); await load() }} />}
  </section>
}
