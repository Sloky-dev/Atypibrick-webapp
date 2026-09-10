import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, ChevronRight, CircleDollarSign, LayoutGrid, PackagePlus, Pencil, Search, Shapes, Trash2 } from 'lucide-react'
import { collectionApi } from './api'
import { SetForm } from './components/SetForm'
import type { CollectionSummary, LegoSet, LegoSetPayload } from './types'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

function App() {
  const [sets, setSets] = useState<LegoSet[]>([])
  const [summary, setSummary] = useState<CollectionSummary>({ setCount: 0, itemCount: 0, totalInvested: '0', averagePrice: '0' })
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<LegoSet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => { setLoading(true); setError(''); try { const [items, totals] = await Promise.all([collectionApi.list(), collectionApi.summary()]); setSets(items); setSummary(totals) } catch (e) { setError(e instanceof Error ? e.message : 'Impossible de charger la collection') } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])
  const filtered = useMemo(() => { const q = query.toLowerCase(); return sets.filter((item) => [item.name, item.setNumber, item.theme || ''].some((value) => value.toLowerCase().includes(q))) }, [sets, query])
  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const save = async (payload: LegoSetPayload) => { if (editing) await collectionApi.update(editing.id, payload); else await collectionApi.create(payload); setFormOpen(false); await load() }
  const remove = async (item: LegoSet) => { if (!confirm(`Supprimer « ${item.name} » de votre collection ?`)) return; await collectionApi.remove(item.id); await load() }

  return <div className="app-shell">
    <header><a className="brand" href="#"><span className="brand-mark"><span /></span><strong>ATYPI<span>BRICK</span></strong></a><nav><a className="active" href="#collection">Ma collection</a><a href="#stats">Statistiques</a></nav><button className="button primary compact" onClick={openCreate}><PackagePlus size={18} /> Ajouter un set</button></header>
    <main>
      <section className="hero"><div><span className="eyebrow">TABLEAU DE BORD</span><h1>Ma collection,<br /><em>brique par brique.</em></h1><p>Gardez une vue claire sur chaque set et sur ce que votre passion représente.</p></div><div className="hero-bricks"><i /><i /><i /><i /></div></section>
      <section className="stats" id="stats">
        <article><span className="stat-icon yellow"><Box /></span><div><small>SETS DIFFÉRENTS</small><strong>{summary.setCount}</strong><p>{summary.itemCount} boîte{summary.itemCount > 1 ? 's' : ''} au total</p></div></article>
        <article><span className="stat-icon blue"><CircleDollarSign /></span><div><small>TOTAL INVESTI</small><strong>{euro.format(Number(summary.totalInvested))}</strong><p>Prix d'achat cumulé</p></div></article>
        <article><span className="stat-icon red"><Shapes /></span><div><small>PRIX MOYEN</small><strong>{euro.format(Number(summary.averagePrice))}</strong><p>Par set référencé</p></div></article>
      </section>
      <section className="collection" id="collection"><div className="section-head"><div><span className="eyebrow">INVENTAIRE</span><h2>Mes sets LEGO</h2></div><div className="search"><Search size={18} /><input aria-label="Rechercher" placeholder="Rechercher un set, un thème…" value={query} onChange={(e) => setQuery(e.target.value)} /></div></div>
        {error && <div className="error"><strong>Le backend ne répond pas.</strong><span>{error}</span><button onClick={() => void load()}>Réessayer</button></div>}
        {!error && loading && <div className="empty"><div className="loader" /><p>Chargement de votre collection…</p></div>}
        {!error && !loading && filtered.length === 0 && <div className="empty"><span className="empty-icon"><LayoutGrid /></span><h3>{query ? 'Aucun set ne correspond' : 'Votre collection commence ici'}</h3><p>{query ? 'Essayez une autre recherche.' : 'Ajoutez votre premier set LEGO pour commencer à suivre votre investissement.'}</p>{!query && <button className="button primary" onClick={openCreate}><PackagePlus size={18} /> Ajouter mon premier set</button>}</div>}
        {!error && !loading && filtered.length > 0 && <div className="set-grid">{filtered.map((item) => <article className="set-card" key={item.id}>
          <div className="set-visual">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span><Box /></span>}<b>{item.condition}</b></div>
          <div className="set-content"><small>{item.theme || 'Sans thème'} · #{item.setNumber}</small><h3>{item.name}</h3><div className="set-bottom"><div><span>Investi</span><strong>{euro.format(Number(item.purchasePrice) * item.quantity)}</strong></div><div className="card-actions"><button onClick={() => { setEditing(item); setFormOpen(true) }} aria-label="Modifier"><Pencil /></button><button className="danger" onClick={() => void remove(item)} aria-label="Supprimer"><Trash2 /></button><ChevronRight className="chevron" /></div></div></div>
        </article>)}</div>}
      </section>
    </main>
    <footer><span>ATYPIBRICK</span><p>Votre collection. Votre histoire. Brique après brique.</p><small>Fait avec passion pour les briques.</small></footer>
    {formOpen && <SetForm item={editing} onClose={() => setFormOpen(false)} onSubmit={save} />}
  </div>
}

export default App
