import { useCallback, useEffect, useRef, useState } from 'react'
import { Box, CalendarDays, ChevronRight, ClipboardCheck, ExternalLink, LayoutGrid, Library, LogOut, Menu, PackagePlus, Palette, Pencil, Puzzle, Search, SlidersHorizontal, Tags, Trash2, UserRound, X } from 'lucide-react'
import { authApi, clearSession, collectionApi } from './api'
import { AccountModal } from './components/AccountModal'
import { LoginPage } from './components/LoginPage'
import { InventoryModal } from './components/InventoryModal'
import { SetForm } from './components/SetForm'
import { StatisticsBreakdown } from './components/StatisticsBreakdown'
import { TrashModal } from './components/TrashModal'
import { CollectionFiltersPanel, emptyCollectionFilters } from './components/CollectionFiltersPanel'
import { MissingPartsModal } from './components/MissingPartsModal'
import { PickABrickModal } from './components/PickABrickModal'
import type { CollectionFilters, CollectionSummary, LegoSet, LegoSetPayload, User } from './types'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const PAGE_SIZE = 9

function needsImageRepair(item: LegoSet): boolean {
  const isCada = /^C\d{4,6}W?$/i.test(item.setNumber)
  const hasVersionedLocalImage = item.imageUrl?.startsWith('/media/atypibrick/sets/')
    && item.imageUrl.includes('?v=')
  return !item.imageUrl || (isCada && !hasVersionedLocalImage)
}

async function repairMissingImages(items: LegoSet[], onBatch: (items: LegoSet[]) => void): Promise<void> {
  const missing = items.filter(needsImageRepair)
  for (let start = 0; start < missing.length; start += 3) {
    const batch = missing.slice(start, start + 3)
    const repaired = await Promise.all(batch.map((item) => collectionApi.repairImage(item.id).catch(() => item)))
    onBatch(repaired)
  }
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [accountOpen, setAccountOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const [trashOpen, setTrashOpen] = useState(false)
  const [missingPartsSet, setMissingPartsSet] = useState<LegoSet | null>(null)
  const [pickABrickOpen, setPickABrickOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sets, setSets] = useState<LegoSet[]>([])
  const [latestSet, setLatestSet] = useState<LegoSet | undefined>()
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [summary, setSummary] = useState<CollectionSummary>({ setCount: 0, itemCount: 0, totalInvested: '0', totalParts: 0, brands: [], themes: [], conditions: [], purchaseYears: [] })
  const [query, setQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState<CollectionFilters>(emptyCollectionFilters)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<LegoSet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const listGeneration = useRef(0)
  const loadingMoreRef = useRef(false)
  const loadMoreSentinel = useRef<HTMLDivElement | null>(null)

  const repairImagesInBackground = useCallback((items: LegoSet[], generation: number) => {
    if (!items.some(needsImageRepair)) return
    void repairMissingImages(items, (repaired) => {
      if (generation !== listGeneration.current) return
      const replacements = new Map(repaired.map((item) => [item.id, item]))
      setSets((current) => current.map((item) => replacements.get(item.id) ?? item))
      setLatestSet((current) => current ? replacements.get(current.id) ?? current : current)
    })
  }, [])

  const load = useCallback(async (search = '') => {
    const generation = ++listGeneration.current
    setLoading(true); setError('')
    try {
      const [page, totals] = await Promise.all([collectionApi.list(search, null, PAGE_SIZE, filters), collectionApi.summary()])
      if (generation !== listGeneration.current) return
      setSets(page.items); setHasMore(page.hasMore); setNextCursor(page.nextCursor); setSummary(totals)
      if (!search) setLatestSet(page.items[0])
      repairImagesInBackground(page.items, generation)
    } catch (e) {
      if (generation === listGeneration.current) setError(e instanceof Error ? e.message : 'Impossible de charger la collection')
    } finally {
      if (generation === listGeneration.current) setLoading(false)
    }
  }, [filters, repairImagesInBackground])

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMoreRef.current) return
    loadingMoreRef.current = true; setLoadingMore(true)
    const generation = listGeneration.current
    try {
      const page = await collectionApi.list(query.trim(), nextCursor, PAGE_SIZE, filters)
      if (generation !== listGeneration.current) return
      setSets((current) => [...current, ...page.items.filter((item) => !current.some((existing) => existing.id === item.id))])
      setHasMore(page.hasMore)
      setNextCursor(page.nextCursor)
      repairImagesInBackground(page.items, generation)
    } catch (e) {
      if (generation === listGeneration.current) setError(e instanceof Error ? e.message : 'Impossible de charger la suite')
    } finally {
      loadingMoreRef.current = false; setLoadingMore(false)
    }
  }, [filters, hasMore, nextCursor, query, repairImagesInBackground])
  useEffect(() => {
    authApi.me().then(setUser).catch(clearSession).finally(() => setAuthLoading(false))
  }, [])
  useEffect(() => { if (!user) return; const timer = window.setTimeout(() => void load(query.trim()), 350); return () => window.clearTimeout(timer) }, [load, query, user])
  useEffect(() => {
    const target = loadMoreSentinel.current
    if (!target || !hasMore || loading) return
    const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) void loadMore() }, { rootMargin: '300px' })
    observer.observe(target)
    return () => observer.disconnect()
  }, [hasMore, loadMore, loading])
  useEffect(() => { const logout = () => { setUser(null) }; window.addEventListener('atypibrick:unauthorized', logout); return () => window.removeEventListener('atypibrick:unauthorized', logout) }, [])
  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const save = async (payload: LegoSetPayload) => { if (editing) await collectionApi.update(editing.id, payload); else await collectionApi.create(payload); setFormOpen(false); await load(query.trim()) }
  const remove = async (item: LegoSet) => { if (!confirm(`Placer « ${item.name} » dans la corbeille ? Vous pourrez le restaurer pendant 30 jours.`)) return; await collectionApi.remove(item.id); await load(query.trim()) }
  const inventoryCompleted = async () => { setInventoryOpen(false); await load(query.trim()) }
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => key === 'sort' ? value !== 'newest' : Boolean(value)).length

  const selectStatistic = (selection: Partial<CollectionFilters>) => {
    setQuery('')
    setFilters({ ...emptyCollectionFilters, ...selection })
    document.getElementById('collection')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
  }

  if (authLoading) return <div className="auth-loader"><div className="loader" /><span>ATYPIBRICK</span></div>
  if (!user) return <LoginPage onLogin={setUser} />
  const logout = () => { void authApi.logout().finally(() => { clearSession(); setUser(null); setSets([]) }) }

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="sidebar-top"><a className="brand" href="#"><img src="/atypik-mark.svg" alt="" width="43" height="43" /><span><strong>ATYPIBRICK</strong><small>UN UNIVERS ATYPIK</small></span></a><button className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu"><X /></button></div>
      <button className="button primary sidebar-add" onClick={() => { openCreate(); setMenuOpen(false) }}><PackagePlus /> Ajouter un set</button>
      <nav className="sidebar-nav" aria-label="Navigation principale">
        <small>ESPACE COLLECTION</small>
        <a className="active" href="#collection" onClick={() => { setMenuOpen(false) }}><Library /> Ma collection</a>
        <button type="button" onClick={() => { setPickABrickOpen(true); setMenuOpen(false) }}><Puzzle /> Pick a Brick</button>
        <button type="button" onClick={() => { setTrashOpen(true); setMenuOpen(false) }}><Trash2 /> Corbeille</button>
        <small>ATYPIBRICK</small>
        <a href="https://atypikbzh.fr/atypibrick/"><ExternalLink /> Découvrir l’univers</a>
      </nav>
      <div className={`sidebar-account ${accountMenuOpen ? 'open' : ''}`}><button type="button" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen((open) => !open)}><span className="account-avatar"><UserRound /></span><span><strong>Mon compte</strong><small>{user.email}</small></span><ChevronRight /></button>{accountMenuOpen && <div className="account-menu"><button type="button" onClick={() => { setAccountMenuOpen(false); setAccountOpen(true); setMenuOpen(false) }}><UserRound /> Modifier mes informations</button><button type="button" className="danger" onClick={() => { setAccountMenuOpen(false); logout() }}><LogOut /> Déconnexion</button></div>}</div>
    </aside>
    {menuOpen && <button className="sidebar-overlay" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu" />}
    <div className="page-shell">
    <header className="mobile-header"><a className="brand" href="#"><img src="/atypik-mark.svg" alt="" width="38" height="38" /><span><strong>ATYPIBRICK</strong><small>UN UNIVERS ATYPIK</small></span></a><button onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu"><Menu /></button></header>
    <main>
      <section className="hero dashboard-hero">
        <div className="hero-dashboard-copy"><span className="eyebrow">VUE D’ENSEMBLE</span><h1>Ma collection<br /><em>BRICK.</em></h1><p>Retrouvez vos sets, suivez votre investissement et contrôlez votre collection depuis un seul espace.</p><div className="hero-actions"><button className="button primary" onClick={openCreate}><PackagePlus /> Ajouter un set</button><button className="button ghost" onClick={() => setInventoryOpen(true)}><ClipboardCheck /> Faire l’inventaire</button></div><div className="hero-summary"><span><strong>{summary.itemCount}</strong><small>EXEMPLAIRE{summary.itemCount > 1 ? 'S' : ''}</small></span><span><strong>{summary.totalParts.toLocaleString('fr-FR')}</strong><small>BRIQUES</small></span><span><strong>{euro.format(Number(summary.totalInvested))}</strong><small>INVESTIS</small></span></div></div>
        <div className="latest-set-panel">{latestSet ? <><div className="latest-set-head"><span>DERNIER AJOUT</span><button onClick={() => { setEditing(latestSet); setFormOpen(true) }}>Modifier <Pencil /></button></div><div className="latest-set-image">{latestSet.imageUrl ? <img src={latestSet.imageUrl} alt={`Boîte du set ${latestSet.name}`} /> : <Box />}</div><div className="latest-set-info"><small>{latestSet.brand} · {latestSet.theme || 'Sans thème'} · #{latestSet.setNumber}</small><strong>{latestSet.name}</strong><span>{Number(latestSet.totalInvested) > 0 ? euro.format(Number(latestSet.totalInvested)) : 'Reçu en cadeau'}</span></div></> : <><div className="latest-set-empty"><Box /><span>VOTRE PREMIER SET</span><strong>La collection commence ici.</strong><button className="button primary" onClick={openCreate}><PackagePlus /> Ajouter un set</button></div></>}</div>
      </section>
      <section className="stats breakdown-stats" id="stats">
        <StatisticsBreakdown title="RÉPARTITION PAR MARQUE" subtitle="Marques de votre collection" icon={<Box />} items={summary.brands} selectedLabel={filters.brand} onSelect={(item) => selectStatistic({ brand: item.label as CollectionFilters['brand'] })} />
        <StatisticsBreakdown title="RÉPARTITION PAR THÈME" subtitle="Univers les plus présents" icon={<Palette />} items={summary.themes} formatLabel={(item) => item.brands?.length ? `${item.label} (${item.brands.join(', ')})` : item.label} selectedLabel={filters.theme} onSelect={(item) => selectStatistic({ theme: item.label })} />
        <StatisticsBreakdown title="CONDITIONS D’ACHAT" subtitle="Sets achetés neufs ou d’occasion" icon={<Tags />} items={summary.conditions} />
        <StatisticsBreakdown title="ANNÉES D’ACHAT" subtitle="Chronologie de la collection" icon={<CalendarDays />} items={summary.purchaseYears} />
      </section>
      <section className="collection" id="collection"><div className="section-head"><div><span className="eyebrow">INVENTAIRE</span><h2>Mes sets BRICK</h2></div><div className="collection-tools"><button className={`filter-toggle ${activeFilterCount ? 'active' : ''}`} onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal /> Filtres{activeFilterCount ? ` (${activeFilterCount})` : ''}</button><div className="search"><Search size={18} /><input aria-label="Rechercher" placeholder="Rechercher un set, un thème…" value={query} onChange={(e) => setQuery(e.target.value)} /></div></div></div>
        {(activeFilterCount > 0 || query) && <div className="active-collection-filters"><span>{[filters.brand, filters.theme, filters.condition].filter(Boolean).join(' · ') || 'Liste filtrée'}</span><button type="button" onClick={() => { setFilters(emptyCollectionFilters); setQuery('') }}><X size={14} /> Effacer les filtres</button></div>}
        {filtersOpen && <CollectionFiltersPanel filters={filters} summary={summary} onChange={setFilters} onClose={() => setFiltersOpen(false)} />}
        {error && <div className="error"><strong>Le backend ne répond pas.</strong><span>{error}</span><button onClick={() => void load()}>Réessayer</button></div>}
        {!error && loading && <div className="empty"><div className="loader" /><p>Chargement de votre collection…</p></div>}
        {!error && !loading && sets.length === 0 && <div className="empty"><span className="empty-icon"><LayoutGrid /></span><h3>{query || activeFilterCount ? 'Aucun set ne correspond' : 'Votre collection commence ici'}</h3><p>{query || activeFilterCount ? 'Modifiez ou effacez vos filtres.' : 'Ajoutez votre premier set LEGO pour commencer à suivre votre investissement.'}</p>{!query && !activeFilterCount && <button className="button primary" onClick={openCreate}><PackagePlus size={18} /> Ajouter mon premier set</button>}</div>}
        {!error && !loading && sets.length > 0 && <><div className="set-grid">{sets.map((item) => <article className="set-card" key={item.id}>
          <div className="set-visual">{item.imageUrl ? <span className="set-image-frame"><img src={item.imageUrl} alt="" /></span> : <span><Box /></span>}<span className="set-badges"><b>{item.isGift ? 'Cadeau' : item.condition}</b>{item.isSealed && <b>Scellé</b>}{item.brand === 'LEGO' && item.missingPartsCount > 0 && <b className="incomplete">Incomplet</b>}</span></div>
          <div className="set-content"><small>{item.brand} · {item.theme || 'Sans thème'}{item.numParts ? ` · ${item.numParts.toLocaleString('fr-FR')} pièces` : ''} · #{item.setNumber}</small><h3>{item.name}</h3><div className="set-bottom"><div><span>{Number(item.totalInvested) > 0 ? 'Investi' : 'Reçu en cadeau'}</span><strong>{Number(item.totalInvested) > 0 ? euro.format(Number(item.totalInvested)) : 'Cadeau'}</strong></div><div className="card-actions">{item.brand === 'LEGO' && <button onClick={() => setMissingPartsSet(item)} aria-label="Gérer les pièces manquantes" title="Pièces manquantes"><Puzzle /></button>}<button onClick={() => { setEditing(item); setFormOpen(true) }} aria-label="Modifier"><Pencil /></button><button className="danger" onClick={() => void remove(item)} aria-label="Supprimer"><Trash2 /></button><ChevronRight className="chevron" /></div></div></div>
        </article>)}</div><div ref={loadMoreSentinel} className="load-more-sentinel" aria-live="polite">{loadingMore && <><div className="loader" /><span>Chargement des sets suivants…</span></>}{!hasMore && <span>{sets.length} set{sets.length > 1 ? 's' : ''} affiché{sets.length > 1 ? 's' : ''}</span>}</div></>}
      </section>
    </main>
    <footer><div className="footer-brand"><img src="/atypik-mark.svg" alt="" width="34" height="34" /><span>ATYPIBRICK<small>UN UNIVERS ATYPIK</small></span></div><p>Votre collection. Votre histoire. Brique après brique.</p><a href="https://atypikbzh.fr/">Atypik — Le Studio ↗</a></footer>
    </div>
    {formOpen && <SetForm item={editing} onClose={() => setFormOpen(false)} onSubmit={save} />}
    {accountOpen && <AccountModal user={user} onClose={() => setAccountOpen(false)} />}
    {inventoryOpen && <InventoryModal onClose={() => setInventoryOpen(false)} onCompleted={inventoryCompleted} />}
    {trashOpen && <TrashModal onClose={() => setTrashOpen(false)} onRestored={() => load(query.trim())} />}
    {missingPartsSet?.brand === 'LEGO' && <MissingPartsModal set={missingPartsSet} onClose={() => setMissingPartsSet(null)} onChange={(count, addedInvestment = 0) => { const updateSet = (item: LegoSet) => item.id === missingPartsSet.id ? { ...item, missingPartsCount: count, replacementCost: String(Number(item.replacementCost) + addedInvestment), totalInvested: String(Number(item.totalInvested) + addedInvestment) } : item; setSets((current) => current.map(updateSet)); setLatestSet((current) => current ? updateSet(current) : current); setMissingPartsSet((current) => current ? updateSet(current) : current); if (addedInvestment) setSummary((current) => ({ ...current, totalInvested: String(Number(current.totalInvested) + addedInvestment) })) }} />}
    {pickABrickOpen && <PickABrickModal onClose={() => setPickABrickOpen(false)} />}
  </div>
}

export default App
