import { useEffect, useState, type ReactNode } from 'react'
import { Box, ExternalLink, LayoutGrid, Library, LogOut, Menu, PackagePlus, Puzzle, Trash2, UserRound, X, ChevronRight } from 'lucide-react'
import { Link, NavLink, useLocation, useNavigationType } from 'react-router'
import { paths } from '../navigation'
import type { User } from '../types'
import { AccountModal } from './AccountModal'
import { useSetActions } from './SetActionsProvider'

export function ApplicationLayout({ user, onLogout, children }: { user: User; onLogout: () => Promise<void>; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const { openCreate } = useSetActions()
  const location = useLocation()
  const navigationType = useNavigationType()
  useEffect(() => { setMenuOpen(false); setAccountMenuOpen(false); if (navigationType !== 'POP') window.scrollTo(0, 0) }, [location.pathname, navigationType])
  const links = [
    { to: paths.dashboard, label: 'Dashboard', icon: <LayoutGrid /> },
    { to: paths.sets, label: 'Mes sets', icon: <Library /> },
    { to: paths.minifigures, label: 'Mes Minifigurines', icon: <UserRound /> },
    { to: paths.mocs, label: 'MOCs', icon: <Box /> },
    { to: paths.pickabrick, label: 'Pick a Brick', icon: <Puzzle /> },
    { to: paths.trash, label: 'Corbeille', icon: <Trash2 /> },
  ]
  return <div className="app-shell"><aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
    <div className="sidebar-top"><Link className="brand" to={paths.sets}><img src="/atypik-mark.svg" alt="" width="43" height="43" /><span><strong>ATYPIBRICK</strong><small>UN UNIVERS ATYPIK</small></span></Link><button className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu"><X /></button></div>
    <button className="button primary sidebar-add" onClick={() => { openCreate(); setMenuOpen(false) }}><PackagePlus /> Ajouter un set</button>
    <nav className="sidebar-nav" aria-label="Navigation principale"><small>ESPACE COLLECTION</small>{links.map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setMenuOpen(false)}>{item.icon}{item.label}</NavLink>)}<small>ATYPIBRICK</small><a href="https://atypikbzh.fr/atypibrick/"><ExternalLink /> Découvrir l’univers</a></nav>
    <div className={`sidebar-account ${accountMenuOpen ? 'open' : ''}`}><button type="button" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen((open) => !open)}><span className="account-avatar"><UserRound /></span><span><strong>Mon compte</strong><small>{user.email}</small></span><ChevronRight /></button>{accountMenuOpen && <div className="account-menu"><button type="button" onClick={() => { setAccountMenuOpen(false); setAccountOpen(true); setMenuOpen(false) }}><UserRound /> Modifier mes informations</button><button type="button" className="danger" onClick={() => { setAccountMenuOpen(false); void onLogout() }}><LogOut /> Déconnexion</button></div>}</div>
  </aside>{menuOpen && <button className="sidebar-overlay" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu" />}<div className="page-shell">
    <header className="mobile-header"><Link className="brand" to={paths.sets}><img src="/atypik-mark.svg" alt="" width="38" height="38" /><span><strong>ATYPIBRICK</strong><small>UN UNIVERS ATYPIK</small></span></Link><button onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu"><Menu /></button></header>
    <main>{children}</main><footer><div className="footer-brand"><img src="/atypik-mark.svg" alt="" width="34" height="34" /><span>ATYPIBRICK<small>UN UNIVERS ATYPIK</small></span></div><p>Votre collection. Votre histoire. Brique après brique.</p><a href="https://atypikbzh.fr/">Atypik — Le Studio ↗</a></footer>
  </div>{accountOpen && <AccountModal user={user} onClose={() => setAccountOpen(false)} />}</div>
}
