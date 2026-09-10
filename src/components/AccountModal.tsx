import { useState } from 'react'
import { X } from 'lucide-react'
import { authApi } from '../api'
import type { User } from '../types'

export function AccountModal({ user, onClose }: { user: User; onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="modal account-modal" onSubmit={async (event) => { event.preventDefault(); setSaving(true); setError(''); setMessage(''); try { await authApi.changePassword(currentPassword, newPassword, confirmation); setCurrentPassword(''); setNewPassword(''); setConfirmation(''); setMessage('Votre mot de passe a été modifié.') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Modification impossible') } finally { setSaving(false) } }}>
    <div className="modal-head"><div><span className="eyebrow">MON COMPTE</span><h2>Sécurité.</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer"><X /></button></div>
    <div className="account-email"><small>COMPTE CONNECTÉ</small><strong>{user.email}</strong></div>
    <div className="form-grid single"><label>Mot de passe actuel<input type="password" required autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label>Nouveau mot de passe<input type="password" required minLength={8} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><small>8 caractères minimum.</small></label><label>Confirmer le nouveau mot de passe<input type="password" required minLength={8} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label></div>
    {error && <p className="form-error">{error}</p>}{message && <p className="form-success">{message}</p>}
    <div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>Fermer</button><button className="button primary" disabled={saving}>{saving ? 'Modification…' : 'Changer le mot de passe'}</button></div>
  </form></div>
}
