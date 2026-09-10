import { useState } from 'react'
import { ArrowRight, LockKeyhole } from 'lucide-react'
import { authApi, saveSession } from '../api'
import type { User } from '../types'

export function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  return <main className="login-page">
    <section className="login-brand"><img src="/atypik-mark.svg" alt="" /><p className="eyebrow">ESPACE PRIVÉ</p><h1>Votre collection.<br /><em>Votre histoire.</em></h1><p>Un espace personnel pour garder la mémoire de chaque set, brique après brique.</p><span>ATYPIBRICK · UN UNIVERS ATYPIK</span></section>
    <form className="login-card" onSubmit={async (event) => { event.preventDefault(); setLoading(true); setError(''); try { const result = await authApi.login(email, password); saveSession(result); onLogin(result.user) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Connexion impossible') } finally { setLoading(false) } }}>
      <div className="login-icon"><LockKeyhole /></div><p className="eyebrow">CONNEXION</p><h2>Bienvenue.</h2><p className="login-intro">Identifiez-vous pour accéder à votre collection.</p>
      <label>Adresse e-mail<input type="email" required autoFocus autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@exemple.fr" /></label>
      <label>Mot de passe<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" /></label>
      {error && <p className="form-error">{error}</p>}
      <button className="button primary login-submit" disabled={loading}>{loading ? 'Connexion…' : <>Accéder à ma collection <ArrowRight /></>}</button>
    </form>
  </main>
}
