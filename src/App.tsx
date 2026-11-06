import { lazy, Suspense } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import { LoginPage } from './components/LoginPage'
import { ApplicationLayout } from './components/ApplicationLayout'
import { NotificationsProvider, useNotifications } from './components/NotificationsProvider'
import { SetActionsProvider } from './components/SetActionsProvider'
import { useAuth } from './hooks/useAuth'
import { useCollectionSummary } from './hooks/useCollectionSummary'
import { emptyCollectionFilters, writeSetSelection } from './collectionFilters'
import { paths } from './navigation'
import type { CollectionFilters, User } from './types'

const SetsPage = lazy(() => import('./components/SetsPage'))
const DashboardPage = lazy(() => import('./components/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const MinifiguresPage = lazy(() => import('./components/MinifiguresPage'))
const MocsPage = lazy(() => import('./components/MocsPage'))
const PickABrickPage = lazy(() => import('./components/PickABrickPage').then((module) => ({ default: module.PickABrickPage })))
const TrashPage = lazy(() => import('./components/TrashPage').then((module) => ({ default: module.TrashPage })))

function Application({ user, onLogout }: { user: User; onLogout: () => Promise<void> }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { notify } = useNotifications()
  const { summary, error, reload } = useCollectionSummary(user.email)
  const selectStatistic = (selection: Partial<CollectionFilters>) => navigate(`${paths.sets}?${writeSetSelection('', { ...emptyCollectionFilters, ...selection })}#collection`)
  return <ApplicationLayout user={user} onLogout={onLogout}><Suspense fallback={<p role="status">Chargement de la page…</p>}><Routes>
    <Route path="/" element={<Navigate replace to={`${paths.sets}${location.search}${location.hash}`} />} />
    <Route path={paths.sets} element={<SetsPage account={user.email} totals={summary} summaryError={error} reloadSummary={reload} />} />
    <Route path={paths.dashboard} element={<DashboardPage onSelect={selectStatistic} summary={summary} summaryError={error} onRetrySummary={reload} />} />
    <Route path={paths.minifigures} element={<MinifiguresPage />} />
    <Route path={paths.mocs} element={<MocsPage />} />
    <Route path={paths.pickabrick} element={<PickABrickPage />} />
    <Route path={paths.trash} element={<TrashPage onRestored={async () => notify('Élément restauré dans la collection.')} />} />
    <Route path="*" element={<section className="empty"><h1>Page introuvable</h1><p>Cette page n’existe pas.</p><Link className="button primary" to={paths.sets}>Revenir à mes sets</Link></section>} />
  </Routes></Suspense></ApplicationLayout>
}

export default function App() {
  const { user, loading, login, logout } = useAuth()
  if (loading) return <div className="auth-loader"><div className="loader" /><span>ATYPIBRICK</span></div>
  if (!user) return <LoginPage onLogin={login} />
  return <BrowserRouter><NotificationsProvider key={user.email}><SetActionsProvider><Application user={user} onLogout={logout} /></SetActionsProvider></NotificationsProvider></BrowserRouter>
}
