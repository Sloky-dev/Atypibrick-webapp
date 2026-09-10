import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, Box, ChevronRight, CircleDollarSign, ExternalLink, LayoutGrid, Library, LogOut, Menu, PackagePlus, Pencil, Search, Shapes, Trash2, UserRound, X } from 'lucide-react'
import { authApi, collectionApi } from './api'
import { AccountModal } from './components/AccountModal'
import { LoginPage } from './components/LoginPage'
import { SetForm } from './components/SetForm'
import type { CollectionSummary, LegoSet, LegoSetPayload, User } from './types'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [accountOpen, setAccountOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sets, setSets] = useState<LegoSet[]>([])
  const [summary, setSummary] = useState<CollectionSummary>({ setCount: 0, itemCount: 0, totalInvested: '0', totalParts: 0 })
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<LegoSet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => { setLoading(true); setError(''); try { const [items, totals] = await Promise.all([collectionApi.list(), collectionApi.summary()]); setSets(items); setSummary(totals) } catch (e) { setError(e instanceof Error ? e.message : 'Impossible de charger la collection') } finally { setLoading(false) } }, [])
  useEffect(() => {
    const token = localStorage.getItem('atypibrick_token')
    if (!token) { setAuthLoading(false); return }
    authApi.me().then(setUser).catch(() => localStorage.removeItem('atypibrick_token')).finally(() => setAuthLoading(false))
  }, [])
  useEffect(() => { if (user) void load() }, [load, user])
  useEffect(() => { const logout = () => setUser(null); window.addEventListener('atypibrick:unauthorized', logout); return () => window.removeEventListener('atypibrick:unauthorized', logout) }, [])
  const filtered = useMemo(() => { const q = query.toLowerCase(); return sets.filter((item) => [item.name, item.setNumber, item.theme || ''].some((value) => value.toLowerCase().includes(q))) }, [sets, query])
  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const save = async (payload: LegoSetPayload) => { if (editing) await collectionApi.update(editing.id, payload); else await collectionApi.create(payload); setFormOpen(false); await load() }
  const remove = async (item: LegoSet) => { if (!confirm(`Supprimer « ${item.name} » de votre collection ?`)) return; await collectionApi.remove(item.id); await load() }

  if (authLoading) return <div className="auth-loader"><div className="loader" /><span>ATYPIBRICK</span></div>
  if (!user) return <LoginPage onLogin={setUser} />
  const logout = () => { localStorage.removeItem('atypibrick_token'); setUser(null); setSets([]) }

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="sidebar-top"><a className="brand" href="#"><img src="/atypik-mark.svg" alt="" width="43" height="43" /><span><strong>ATYPIBRICK</strong><small>UN UNIVERS ATYPIK</small></span></a><button className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu"><X /></button></div>
      <button className="button primary sidebar-add" onClick={() => { openCreate(); setMenuOpen(false) }}><PackagePlus /> Ajouter un set</button>
      <nav className="sidebar-nav" aria-label="Navigation principale">
        <small>ESPACE COLLECTION</small>
        <a className="active" href="#collection" onClick={() => setMenuOpen(false)}><Library /> Ma collection</a>
        <a href="#stats" onClick={() => setMenuOpen(false)}><BarChart3 /> Statistiques</a>
        <small>ATYPIBRICK</small>
        <a href="https://atypikbzh.fr/atypibrick/"><ExternalLink /> Découvrir l’univers</a>
      </nav>
      <div className="sidebar-account"><button onClick={() => { setAccountOpen(true); setMenuOpen(false) }}><span className="account-avatar"><UserRound /></span><span><strong>Mon compte</strong><small>{user.email}</small></span><ChevronRight /></button><button className="logout-button" onClick={logout}><LogOut /> Déconnexion</button></div>
    </aside>
    {menuOpen && <button className="sidebar-overlay" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu" />}
    <div className="page-shell">
    <header className="mobile-header"><a className="brand" href="#"><img src="/atypik-mark.svg" alt="" width="38" height="38" /><span><strong>ATYPIBRICK</strong><small>UN UNIVERS ATYPIK</small></span></a><button onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu"><Menu /></button></header>
    <main>
      <section className="hero"><div><span className="eyebrow">COLLECTION PERSONNELLE</span><h1>Construire.<br />Collectionner.<br /><em>Se souvenir.</em></h1><p>Chaque set raconte une histoire. Gardez une vue claire sur votre collection et sur ce que votre passion représente.</p></div><div className="hero-bricks" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><strong>AB</strong><small>BRIQUE<br />APRÈS BRIQUE</small></div></section>
      <section className="stats" id="stats">
        <article><span className="stat-icon yellow"><Box /></span><div><small>SETS DIFFÉRENTS</small><strong>{summary.setCount}</strong><p>{summary.itemCount} boîte{summary.itemCount > 1 ? 's' : ''} au total</p></div></article>
        <article><span className="stat-icon blue"><CircleDollarSign /></span><div><small>TOTAL INVESTI</small><strong>{euro.format(Number(summary.totalInvested))}</strong><p>Prix d'achat cumulé</p></div></article>
        <article><span className="stat-icon red"><Shapes /></span><div><small>NOMBRE TOTAL DE BRIQUES</small><strong>{summary.totalParts.toLocaleString('fr-FR')}</strong><p>Pièces dans toute la collection</p></div></article>
      </section>
      <section className="collection" id="collection"><div className="section-head"><div><span className="eyebrow">INVENTAIRE</span><h2>Mes sets LEGO</h2></div><div className="search"><Search size={18} /><input aria-label="Rechercher" placeholder="Rechercher un set, un thème…" value={query} onChange={(e) => setQuery(e.target.value)} /></div></div>
        {error && <div className="error"><strong>Le backend ne répond pas.</strong><span>{error}</span><button onClick={() => void load()}>Réessayer</button></div>}
        {!error && loading && <div className="empty"><div className="loader" /><p>Chargement de votre collection…</p></div>}
        {!error && !loading && filtered.length === 0 && <div className="empty"><span className="empty-icon"><LayoutGrid /></span><h3>{query ? 'Aucun set ne correspond' : 'Votre collection commence ici'}</h3><p>{query ? 'Essayez une autre recherche.' : 'Ajoutez votre premier set LEGO pour commencer à suivre votre investissement.'}</p>{!query && <button className="button primary" onClick={openCreate}><PackagePlus size={18} /> Ajouter mon premier set</button>}</div>}
        {!error && !loading && filtered.length > 0 && <div className="set-grid">{filtered.map((item) => <article className="set-card" key={item.id}>
          <div className="set-visual">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span><Box /></span>}<b>{item.isGift ? 'Cadeau' : item.condition}</b></div>
          <div className="set-content"><small>{item.theme || 'Sans thème'}{item.numParts ? ` · ${item.numParts.toLocaleString('fr-FR')} pièces` : ''} · #{item.setNumber}</small><h3>{item.name}</h3><div className="set-bottom"><div><span>{item.isGift ? 'Reçu en cadeau' : 'Investi'}</span><strong>{item.isGift ? 'Cadeau' : euro.format(Number(item.purchasePrice))}</strong></div><div className="card-actions"><button onClick={() => { setEditing(item); setFormOpen(true) }} aria-label="Modifier"><Pencil /></button><button className="danger" onClick={() => void remove(item)} aria-label="Supprimer"><Trash2 /></button><ChevronRight className="chevron" /></div></div></div>
        </article>)}</div>}
      </section>
    </main>
    <footer><div className="footer-brand"><img src="/atypik-mark.svg" alt="" width="34" height="34" /><span>ATYPIBRICK<small>UN UNIVERS ATYPIK</small></span></div><p>Votre collection. Votre histoire. Brique après brique.</p><a href="https://atypikbzh.fr/">Atypik — Le Studio ↗</a></footer>
    </div>
    {formOpen && <SetForm item={editing} onClose={() => setFormOpen(false)} onSubmit={save} />}
    {accountOpen && <AccountModal user={user} onClose={() => setAccountOpen(false)} />}
  </div>
}

export default App
