import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, UserRound, X, RotateCcw } from 'lucide-react'
import { collectionApi } from '../api'
import type { LegoSet } from '../types'
import { minifigureApi, miniPhoto, type MiniCollection, type MiniCopy, type MiniCopyInput, type MiniSeries, type MiniSeriesInput } from '../minifigures'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const reasonText = (reason: unknown) => reason instanceof Error ? reason.message : 'L’action a échoué. Réessayez.'
const blankCopy = (seriesId: string, characterId: string | null): MiniCopyInput => ({ seriesId, characterId, purchasePrice: '0', purchaseDate: null, condition: 'Neuf', sealed: !characterId, accessoriesComplete: true, isGift: false, sourceSetId: null, includedInSet: false, notes: '', imageUrl: null })

function Photo({ value, onChange, onError, onBusy }: { value: string | null; onChange: (value: string | null) => void; onError: (message: string) => void; onBusy: (busy: boolean) => void }) {
  const [busy, setBusy] = useState(false)
  return <div className="mini-photo-input"><label>Photo personnelle<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async (event) => {
    const file = event.target.files?.[0]; if (!file) return
    setBusy(true); onBusy(true)
    try { onChange(await miniPhoto(file)) } catch (reason) { onError(reasonText(reason)) } finally { setBusy(false); onBusy(false) }
  }} /></label>{busy && <span>Préparation de la photo…</span>}{value && <><img src={value} alt="Photo sélectionnée" /><button type="button" onClick={() => onChange(null)}>Retirer la photo</button></>}</div>
}

function CopyForm({ series, initial, id, onClose, onSave }: { series: MiniSeries; initial: MiniCopyInput; id?: string; onClose: () => void; onSave: () => Promise<void> }) {
  const [form, setForm] = useState(initial)
  const [photoBusy, setPhotoBusy] = useState(false)
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
    event.preventDefault(); if (busy || photoBusy) return; setBusy(true); setError('')
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
      <div className="full"><Photo value={form.imageUrl} onChange={(imageUrl) => setForm((current) => ({ ...current, imageUrl }))} onError={setError} onBusy={setPhotoBusy} /></div>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-actions"><button type="button" className="button ghost" disabled={busy} onClick={onClose}>Annuler</button><button className="button primary" disabled={busy || photoBusy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button></div>
  </form></div>
}

export default function MinifiguresPage() {
  const [data, setData] = useState<MiniCollection>({ series: [], copies: [] })
  const [catalog, setCatalog] = useState<MiniSeriesInput[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ message: string; undoId?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<'copies' | 'series' | 'trash'>('copies')
  const [search, setSearch] = useState('')
  const [selectedSeries, setSelectedSeries] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [trash, setTrash] = useState<MiniCopy[]>([])
  const [addingSeries, setAddingSeries] = useState(false)
  const [seriesSearch, setSeriesSearch] = useState('')
  const [seriesForm, setSeriesForm] = useState({ name: '', brand: 'LEGO', reference: '', theme: '', expectedCount: '', names: '' })
  const [characterSeries, setCharacterSeries] = useState<MiniSeries | null>(null)
  const [characterPhotoBusy, setCharacterPhotoBusy] = useState(false)
  const [characterId, setCharacterId] = useState<string | null>(null)
  const [characterForm, setCharacterForm] = useState({ name: '', catalogReference: '', imageUrl: null as string | null })
  const [formError, setFormError] = useState('')
  const [editing, setEditing] = useState<{ series: MiniSeries; form: MiniCopyInput; id?: string } | null>(null)
  const load = useCallback(async () => {
    setError('')
    try { const result = await minifigureApi.list(); setData(result) }
    catch (reason) { setError(reasonText(reason)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load(); void minifigureApi.catalog().then(setCatalog).catch(() => setCatalog([])) }, [load])
  useEffect(() => { if (!notice || busy) return; const timer = window.setTimeout(() => setNotice(null), notice.undoId ? 10000 : 5000); return () => window.clearTimeout(timer) }, [notice, busy])
  const refreshTrash = async () => { try { setTrash(await minifigureApi.trash()) } catch (reason) { setError(reasonText(reason)) } }
  const openCopy = (series: MiniSeries, characterId: string | null, copy?: MiniCopy) => setEditing({ series, form: copy || blankCopy(series.id, characterId), id: copy?.id })
  const addSeries = async (payload: MiniSeriesInput) => {
    setBusy(true); setFormError('')
    try { const series = await minifigureApi.series(payload); await load(); setSelectedSeries(series.id); setView('series'); setAddingSeries(false); setNotice({ message: 'Série ajoutée. Choisissez vos personnages.' }) }
    catch (reason) { setFormError(reasonText(reason)) } finally { setBusy(false) }
  }
  const remove = async (copy: MiniCopy) => {
    setBusy(true); setError('')
    try { await minifigureApi.remove(copy.id); await load(); setNotice({ message: 'Exemplaire placé dans la corbeille.', undoId: copy.id }) }
    catch (reason) { setError(reasonText(reason)) } finally { setBusy(false) }
  }
  const restore = async (id: string) => {
    setBusy(true); setError('')
    try { await minifigureApi.restore(id); await load(); await refreshTrash(); setNotice({ message: 'Exemplaire restauré.' }) }
    catch (reason) { setError(reasonText(reason)) } finally { setBusy(false) }
  }
  const matchesSeries = (series: MiniSeries) => (!selectedSeries || selectedSeries === series.id) && `${series.name} ${series.reference || ''} ${series.brand} ${series.theme}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())
  const visibleSeries = data.series.filter(matchesSeries)
  const groups = data.series.flatMap((series) => {
    if (selectedSeries && selectedSeries !== series.id) return []
    const entries = [...series.characters.map((character) => ({ id: character.id as string | null, name: character.name, image: character.imageUrl })), { id: null, name: 'Personnage inconnu — boîte scellée', image: null }]
    return entries.map((character) => ({ series, character, copies: data.copies.filter((copy) => copy.seriesId === series.id && copy.characterId === character.id) }))
  }).filter(({ series, character, copies }) => copies.length && `${series.name} ${series.reference || ''} ${series.theme} ${series.brand} ${character.name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()) && (!stateFilter || (stateFilter === 'duplicates' ? character.id !== null && copies.length > 1 : stateFilter === 'sealed' ? copies.some((copy) => copy.sealed) : copies.some((copy) => !copy.accessoriesComplete))))
  const unique = new Set(data.copies.filter((copy) => copy.characterId).map((copy) => copy.characterId)).size
  const identified = data.copies.filter((copy) => copy.characterId).length
  return <section className="minifigures-page">
    <div className="section-head"><div><span className="eyebrow">MA COLLECTION</span><h1>Minifigurines</h1><p>Vos personnages, vos séries et chaque exemplaire de votre collection.</p></div><button className="button primary" onClick={() => { setAddingSeries(true); setFormError('') }}><Plus /> Ajouter une série</button></div>
    <div className="mini-summary"><span><strong>{data.copies.length}</strong> exemplaires</span><span><strong>{unique}</strong> personnages</span><span><strong>{identified - unique}</strong> doublons</span><span><strong>{euro.format(data.copies.reduce((sum, copy) => sum + Number(copy.purchasePrice), 0))}</strong> investis en figurines</span></div>
    <div className="mini-toolbar"><div className="mini-tabs">{([['copies', 'Mes figurines'], ['series', 'Mes séries'], ['trash', 'Corbeille figurines']] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={view === key} onClick={() => { setView(key); if (key === 'trash') void refreshTrash() }}>{label}</button>)}</div><label>Rechercher<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Personnage, série, numéro, univers…" /></label><label>Série<select value={selectedSeries} onChange={(event) => setSelectedSeries(event.target.value)}><option value="">Toutes les séries</option>{data.series.map((series) => <option key={series.id} value={series.id}>{series.name}</option>)}</select></label>{view === 'copies' && <label>Afficher<select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}><option value="">Tous les exemplaires</option><option value="duplicates">Doublons</option><option value="sealed">Boîtes scellées</option><option value="incomplete">Accessoires incomplets</option></select></label>}{(search || selectedSeries || stateFilter) && <button className="button ghost" onClick={() => { setSearch(''); setSelectedSeries(''); setStateFilter('') }}>Effacer les filtres</button>}</div>
    {error && <div className="error" role="alert">{error}<button onClick={() => void load()}>Réessayer</button></div>}
    {loading && <p role="status">Chargement des minifigurines…</p>}
    {!loading && !data.series.length && !error && <div className="empty"><UserRound /><h3>Votre première série vous attend</h3><p>Recherchez Shrek ou 71053, ou créez votre propre série.</p><button className="button primary" onClick={() => { setAddingSeries(true); setFormError('') }}>Ajouter ma première série</button></div>}
    {view === 'series' && visibleSeries.map((series) => {
      const copies = data.copies.filter((copy) => copy.seriesId === series.id)
      const owned = new Set(copies.filter((copy) => copy.characterId).map((copy) => copy.characterId))
      const total = Math.max(series.expectedCount || 0, series.characters.length)
      const missing = series.characters.filter((character) => !owned.has(character.id))
      return <article className="mini-series" key={series.id}><div className="mini-series-head"><div><small>{series.brand} {series.reference ? `· #${series.reference}` : ''} · {series.theme}</small><h2>{series.name}</h2><p>{owned.size}/{total || '?'} personnages · {copies.length} exemplaires</p></div><button className="button" onClick={() => openCopy(series, null)}>Ajouter une boîte scellée</button></div><progress aria-label={`Progression ${series.name}`} max={total || 1} value={owned.size} /><p className="mini-hint">{missing.length ? `À trouver : ${missing.map((character) => character.name).join(', ')}` : total > owned.size ? 'Complétez la liste des personnages pour suivre ceux qui vous manquent.' : total ? 'Série complète !' : 'Ajoutez les personnages de cette série.'}</p><div className="mini-grid">{series.characters.map((character) => {
        const count = copies.filter((copy) => copy.characterId === character.id).length
        return <div className="mini-character-wrap" key={character.id}><button className={`mini-character ${count ? 'owned' : ''}`} key={character.id} onClick={() => openCopy(series, character.id)}><div className="mini-image">{character.imageUrl || copies.find((copy) => copy.characterId === character.id && copy.imageUrl)?.imageUrl ? <img src={character.imageUrl || copies.find((copy) => copy.characterId === character.id && copy.imageUrl)!.imageUrl!} alt="" /> : <UserRound />}</div><strong>{character.name}</strong><span>{count ? `Possédée ×${count}` : 'Manquante'}</span><small>Ajouter un exemplaire</small></button><button className="mini-edit-character" aria-label={`Modifier la fiche ${character.name}`} onClick={() => { setCharacterSeries(series); setCharacterId(character.id); setCharacterForm({ name: character.name, catalogReference: character.catalogReference || '', imageUrl: character.imageUrl }); setFormError('') }}><Pencil size={13} /> Modifier la fiche / photo</button></div>
      })}<button className="mini-character" onClick={() => { setCharacterSeries(series); setCharacterId(null); setCharacterForm({ name: '', catalogReference: '', imageUrl: null }); setFormError('') }}><Plus /><strong>Ajouter un personnage</strong><small>Saisie manuelle</small></button></div></article>
    })}
    {view === 'copies' && <><div className="mini-grid">{groups.map(({ series, character, copies }) => <article className="mini-owned-card" key={`${series.id}-${character.id}`}><div className="mini-image">{copies.find((copy) => copy.imageUrl)?.imageUrl || character.image ? <img src={copies.find((copy) => copy.imageUrl)?.imageUrl || character.image!} alt={character.name} /> : <UserRound />}</div><small>{series.name} {series.reference ? `· #${series.reference}` : ''}</small><h3>{character.name} <span>×{copies.length}</span></h3><button className="button ghost" onClick={() => openCopy(series, character.id)}><Plus /> Ajouter un exemplaire</button><details><summary>Voir les {copies.length} exemplaire{copies.length > 1 ? 's' : ''}</summary>{copies.map((copy) => <div className="mini-copy" key={copy.id}><p>{copy.condition} · {copy.includedInSet ? 'Incluse dans un set' : copy.isGift ? 'Cadeau' : euro.format(Number(copy.purchasePrice))}{copy.sealed ? ' · Scellée' : ''}{!copy.accessoriesComplete ? ' · Accessoires incomplets' : ''}</p>{copy.purchaseDate && <small>Achat : {new Date(`${copy.purchaseDate}T12:00:00`).toLocaleDateString('fr-FR')}</small>}{copy.notes && <p>{copy.notes}</p>}<div><button aria-label={`Modifier ${character.name}`} onClick={() => openCopy(series, copy.characterId, copy)}><Pencil size={16} /> {copy.characterId ? 'Modifier' : 'Identifier / modifier'}</button><button disabled={busy} aria-label={`Supprimer ${character.name}`} onClick={() => void remove(copy)}><Trash2 size={16} /></button></div></div>)}</details></article>)}</div>{!loading && data.series.length > 0 && !groups.length && <div className="empty"><p>Aucune figurine pour cette sélection.</p><button className="button" onClick={() => setView('series')}>Choisir des personnages dans mes séries</button></div>}</>}
    {view === 'series' && data.series.length > 0 && !visibleSeries.length && <p>Aucune série ne correspond à la recherche.</p>}
    {view === 'trash' && <div className="mini-trash"><p>Les exemplaires retirés restent restaurables ici.</p>{trash.filter((copy) => !selectedSeries || copy.seriesId === selectedSeries).filter((copy) => { const series = data.series.find((item) => item.id === copy.seriesId); return `${series?.name} ${series?.characters.find((character) => character.id === copy.characterId)?.name || 'Personnage inconnu'}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()) }).map((copy) => { const series = data.series.find((item) => item.id === copy.seriesId); return <article key={copy.id}><span>{series?.name} · {series?.characters.find((character) => character.id === copy.characterId)?.name || 'Personnage inconnu'}</span><button className="button" disabled={busy} onClick={() => void restore(copy.id)}><RotateCcw /> Restaurer</button></article> })}{!trash.length && <p>La corbeille des figurines est vide.</p>}</div>}
    {notice && <div className="action-notices"><div className="action-notice"><span role="status">{notice.message}</span>{notice.undoId && <button disabled={busy} onClick={() => void restore(notice.undoId!)}>Annuler la suppression</button>}<button aria-label="Fermer la notification" onClick={() => setNotice(null)}><X size={16} /></button></div></div>}
    {addingSeries && <div className="modal-backdrop"><section className="modal mini-form" role="dialog" aria-modal="true" aria-label="Ajouter une série"><div className="modal-head"><h2>Ajouter une série</h2><button className="icon-button" disabled={busy} aria-label="Fermer" onClick={() => setAddingSeries(false)}><X /></button></div><label>Rechercher une série du catalogue<input value={seriesSearch} onChange={(event) => setSeriesSearch(event.target.value)} placeholder="Shrek, 71053…" /></label><div className="mini-catalog">{catalog.filter((series) => `${series.name} ${series.reference}`.toLocaleLowerCase().includes(seriesSearch.toLocaleLowerCase())).map((series) => <button className="button" key={`${series.brand}-${series.reference}`} disabled={busy} onClick={() => void addSeries(series)}>{series.name} · {series.reference} · {series.characters.length} personnages</button>)}</div><p className="mini-hint">Série absente ? Créez-la ci-dessous. Vous pourrez ajouter les personnages et leurs photos à votre rythme.</p><form onSubmit={(event) => { event.preventDefault(); void addSeries({ name: seriesForm.name, brand: seriesForm.brand, reference: seriesForm.reference || null, theme: seriesForm.theme, expectedCount: seriesForm.expectedCount ? Number(seriesForm.expectedCount) : null, characters: seriesForm.names.split('\n').map((name) => name.trim()).filter(Boolean).map((name) => ({ name, catalogReference: null, imageUrl: null })) }) }}><div className="form-grid"><label>Nom de la série<input required maxLength={160} value={seriesForm.name} onChange={(event) => setSeriesForm({ ...seriesForm, name: event.target.value })} /></label><label>Marque<input required maxLength={60} value={seriesForm.brand} onChange={(event) => setSeriesForm({ ...seriesForm, brand: event.target.value })} /></label><label>Numéro de série (facultatif)<input maxLength={60} value={seriesForm.reference} onChange={(event) => setSeriesForm({ ...seriesForm, reference: event.target.value })} /></label><label>Univers<input maxLength={120} value={seriesForm.theme} onChange={(event) => setSeriesForm({ ...seriesForm, theme: event.target.value })} /></label><label>Nombre total de personnages<input type="number" min="1" max="1000" value={seriesForm.expectedCount} onChange={(event) => setSeriesForm({ ...seriesForm, expectedCount: event.target.value })} /></label><label className="full">Personnages (un par ligne, facultatif)<textarea value={seriesForm.names} onChange={(event) => setSeriesForm({ ...seriesForm, names: event.target.value })} /></label></div><div className="modal-actions"><button className="button primary" disabled={busy}>Créer la série</button></div></form>{formError && <p className="form-error" role="alert">{formError}</p>}</section></div>}
    {characterSeries && <div className="modal-backdrop"><form className="modal mini-form" role="dialog" aria-modal="true" aria-label="Ajouter un personnage" onSubmit={async (event) => { event.preventDefault(); setBusy(true); setFormError(''); try { const payload = { ...characterForm, catalogReference: characterForm.catalogReference || null }; if (characterId) await minifigureApi.updateCharacter(characterSeries.id, characterId, payload); else await minifigureApi.character(characterSeries.id, payload); await load(); setCharacterSeries(null); setNotice({ message: characterId ? 'Fiche du personnage modifiée.' : 'Personnage ajouté à la série.' }) } catch (reason) { setFormError(reasonText(reason)) } finally { setBusy(false) } }}><div className="modal-head"><h2>{characterId ? 'Modifier le personnage' : 'Ajouter un personnage'}</h2><button type="button" className="icon-button" disabled={busy} onClick={() => setCharacterSeries(null)} aria-label="Fermer"><X /></button></div><label>Nom et variante<input required maxLength={160} value={characterForm.name} onChange={(event) => setCharacterForm({ ...characterForm, name: event.target.value })} /></label><label>Référence catalogue (facultative)<input maxLength={80} value={characterForm.catalogReference} onChange={(event) => setCharacterForm({ ...characterForm, catalogReference: event.target.value })} /></label><Photo value={characterForm.imageUrl} onChange={(imageUrl) => setCharacterForm((current) => ({ ...current, imageUrl }))} onError={setFormError} onBusy={setCharacterPhotoBusy} />{formError && <p role="alert" className="form-error">{formError}</p>}<div className="modal-actions"><button className="button primary" disabled={busy || characterPhotoBusy}>{characterId ? 'Enregistrer le personnage' : 'Ajouter le personnage'}</button></div></form></div>}
    {editing && <CopyForm series={editing.series} initial={editing.form} id={editing.id} onClose={() => setEditing(null)} onSave={async () => { setEditing(null); setNotice({ message: editing.id ? 'Exemplaire modifié.' : 'Minifigurine ajoutée à votre collection.' }); await load() }} />}
  </section>
}
