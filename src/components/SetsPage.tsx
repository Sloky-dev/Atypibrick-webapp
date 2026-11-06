import { useEffect, useRef, useState } from 'react'
import { Box, ChevronRight, ClipboardCheck, LayoutGrid, PackagePlus, Pencil, Puzzle, Search, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { useLocation } from 'react-router'
import { useSetsCollection } from '../hooks/useSetsCollection'
import { useSetFilters } from '../hooks/useSetFilters'
import type { CollectionSummary } from '../types'
import { CollectionFiltersPanel } from './CollectionFiltersPanel'
import { useSetActions } from './SetActionsProvider'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const emptySummary: CollectionSummary = { setCount: 0, itemCount: 0, totalInvested: '0', totalParts: 0, brands: [], themes: [], conditions: [], purchaseYears: [] }
export default function SetsPage({ account, totals, summaryError, reloadSummary }: { account: string; totals: CollectionSummary | null; summaryError: string; reloadSummary: () => void }) {
  const summary = totals ?? emptySummary
  const { query, filters, setQuery, setFilters, reset, activeFilterCount } = useSetFilters()
  const { sets, latestSet, hasMore, loading, loadingMore, latestLoading, error, latestError, reload, loadMore } = useSetsCollection(account, query, filters)
  const { openCreate, openEdit, openInventory, openMissingParts, remove, busy: actionBusy } = useSetActions()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const loadMoreSentinel = useRef<HTMLDivElement | null>(null)
  const location = useLocation()
  useEffect(() => {
    const target = loadMoreSentinel.current
    if (!target || !hasMore || loading) return
    const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) void loadMore() }, { rootMargin: '300px' })
    observer.observe(target)
    return () => observer.disconnect()
  }, [hasMore, loadMore, loading])
  useEffect(() => { if (location.hash === '#collection') { const frame = requestAnimationFrame(() => document.getElementById('collection')?.scrollIntoView({ block: 'start' })); return () => cancelAnimationFrame(frame) } }, [location.hash])
  return <>
      {summaryError && <div className="error" role="alert"><span>Impossible d’actualiser les statistiques. {summaryError}</span><button onClick={reloadSummary}>Réessayer les statistiques</button></div>}
      <section className="hero dashboard-hero">
        <div className="hero-dashboard-copy"><span className="eyebrow">VUE D’ENSEMBLE</span><h1>Mes sets<br /><em>BRICK.</em></h1><p>Retrouvez vos sets, suivez votre investissement et contrôlez votre collection depuis un seul espace.</p><div className="hero-actions"><button className="button primary" onClick={openCreate}><PackagePlus /> Ajouter un set</button><button className="button ghost" onClick={() => openInventory()}><ClipboardCheck /> Faire l’inventaire</button></div><div className="hero-summary"><span><strong>{summary.itemCount}</strong><small>EXEMPLAIRE{summary.itemCount > 1 ? 'S' : ''}</small></span><span><strong>{summary.totalParts.toLocaleString('fr-FR')}</strong><small>BRIQUES</small></span><span><span className="investment-amount"><strong>{euro.format(Number(summary.totalInvested) - Number(summary.minifigureInvested || 0))}</strong><span className="minifigure-investment">(hors minifigurines)</span></span><small>INVESTIS</small></span></div></div>
        <div className="latest-set-panel">{latestSet ? <><div className="latest-set-head"><span>DERNIER AJOUT</span><button onClick={() => openEdit(latestSet)}>Modifier <Pencil /></button></div><div className="latest-set-image">{latestSet.imageUrl ? <img src={latestSet.imageUrl} alt={`Boîte du set ${latestSet.name}`} /> : <Box />}</div><div className="latest-set-info"><small>{latestSet.brand} · {latestSet.theme || 'Sans thème'} · #{latestSet.setNumber}</small><strong>{latestSet.name}</strong><span>{Number(latestSet.totalInvested) > 0 ? euro.format(Number(latestSet.totalInvested)) : 'Reçu en cadeau'}</span></div></> : latestError ? <div className="latest-set-empty"><strong>Dernier ajout indisponible</strong><button className="button ghost" onClick={reload}>Réessayer</button></div> : latestLoading ? <p role="status">Chargement du dernier ajout…</p> : <><div className="latest-set-empty"><Box /><span>VOTRE PREMIER SET</span><strong>La collection commence ici.</strong><button className="button primary" onClick={openCreate}><PackagePlus /> Ajouter un set</button></div></>}</div>
      </section>

      <section className="collection" id="collection"><div className="section-head"><div><span className="eyebrow">INVENTAIRE</span><h2>Mes sets BRICK</h2></div><div className="collection-tools"><button type="button" className={`filter-toggle ${filters.incomplete ? 'active' : ''}`} aria-pressed={Boolean(filters.incomplete)} onClick={() => setFilters((current) => ({ ...current, incomplete: current.incomplete ? '' : 'true' }))}><Puzzle /> Sets incomplets</button><button className={`filter-toggle ${activeFilterCount ? 'active' : ''}`} onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal /> Filtres{activeFilterCount ? ` (${activeFilterCount})` : ''}</button><div className="search"><Search size={18} /><input aria-label="Rechercher" placeholder="Rechercher un set, un thème…" value={query} onChange={(e) => setQuery(e.target.value)} /></div></div></div>
        {(activeFilterCount > 0 || query) && <div className="active-collection-filters"><span>{[filters.brand, filters.theme, filters.condition, filters.incomplete && 'Sets incomplets'].filter(Boolean).join(' · ') || 'Liste filtrée'}</span><button type="button" onClick={() => { reset() }}><X size={14} /> Effacer les filtres</button></div>}
        {filtersOpen && <CollectionFiltersPanel filters={filters} summary={summary} onChange={setFilters} onClose={() => setFiltersOpen(false)} />}
        {error && <div className="error"><strong>Impossible d’actualiser la collection.</strong><span>{error}</span><button onClick={() => reload()}>Réessayer</button></div>}
        {!error && loading && <div className="empty"><div className="loader" /><p>Chargement de votre collection…</p></div>}
        {!error && !loading && sets.length === 0 && <div className="empty"><span className="empty-icon"><LayoutGrid /></span><h3>{query || activeFilterCount ? 'Aucun set ne correspond' : 'Votre collection commence ici'}</h3><p>{query || activeFilterCount ? 'Modifiez ou effacez vos filtres.' : 'Ajoutez votre premier set LEGO pour commencer à suivre votre investissement.'}</p>{!query && !activeFilterCount && <button className="button primary" onClick={openCreate}><PackagePlus size={18} /> Ajouter mon premier set</button>}</div>}
        {!error && !loading && sets.length > 0 && <><div className="set-grid">{sets.map((item) => <article className="set-card" key={item.id}>
          <div className="set-visual">{item.imageUrl ? <span className="set-image-frame"><img src={item.imageUrl} alt="" /></span> : <span><Box /></span>}<span className="set-badges"><b>{item.isGwp ? 'GWP' : item.isGift ? 'Cadeau' : item.condition}</b>{item.isSealed && <b>Scellé</b>}{item.brand === 'LEGO' && item.missingPartsCount > 0 && <b className="incomplete">Incomplet</b>}</span></div>
          <div className="set-content"><small>{item.brand} · {item.theme || 'Sans thème'}{item.numParts ? ` · ${item.numParts.toLocaleString('fr-FR')} pièces` : ''} · #{item.setNumber}</small><h3>{item.name}</h3>{item.brand === 'LEGO' && item.missingPartsCount > 0 && <button type="button" className="missing-parts-link" onClick={() => openMissingParts(item)}><Puzzle size={15} /> {item.missingPartsCount} pièce{item.missingPartsCount > 1 ? 's' : ''} manquante{item.missingPartsCount > 1 ? 's' : ''}</button>}<div className="set-bottom"><div><span>{Number(item.totalInvested) > 0 ? 'Investi' : item.isGwp ? 'Offert avec un achat' : item.isGift ? 'Reçu en cadeau' : 'Investi'}</span><strong>{Number(item.totalInvested) > 0 ? euro.format(Number(item.totalInvested)) : item.isGwp ? 'GWP' : item.isGift ? 'Cadeau' : euro.format(0)}</strong></div><div className="card-actions">{item.brand === 'LEGO' && <button onClick={() => openMissingParts(item)} aria-label="Gérer les pièces manquantes" title="Pièces manquantes"><Puzzle /></button>}<button onClick={() => openEdit(item)} aria-label="Modifier"><Pencil /></button><button className="danger" disabled={actionBusy} onClick={() => void remove(item)} aria-label="Supprimer"><Trash2 /></button><ChevronRight className="chevron" /></div></div></div>
        </article>)}</div><div ref={loadMoreSentinel} className="load-more-sentinel" aria-live="polite">{loadingMore && <><div className="loader" /><span>Chargement des sets suivants…</span></>}{!hasMore && <span>{sets.length} set{sets.length > 1 ? 's' : ''} affiché{sets.length > 1 ? 's' : ''}</span>}</div></>}
      </section>
  </>
}
