import { useEffect, useMemo, useState } from 'react'
import { Box, Check, ClipboardCheck, History, Trash2, X } from 'lucide-react'
import { inventoryApi } from '../api'
import type { InventoryOverview, InventorySession } from '../types'

type Props = { onClose: () => void; onCompleted: () => Promise<void> }

export function InventoryModal({ onClose, onCompleted }: Props) {
  const [overview, setOverview] = useState<InventoryOverview | null>(null)
  const [inventory, setInventory] = useState<InventorySession | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const missing = useMemo(() => inventory?.items.filter((item) => item.status !== 'present') ?? [], [inventory])

  useEffect(() => { inventoryApi.overview().then((result) => { setOverview(result); setInventory(result.active) }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Chargement impossible')) }, [])
  const start = async () => { setError(''); try { setInventory(await inventoryApi.start()) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Démarrage impossible') } }
  const toggle = async (itemId: string, present: boolean) => {
    if (!inventory || savingId) return
    setSavingId(itemId); setError('')
    try { setInventory(await inventoryApi.markPresent(inventory.id, itemId, present)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Enregistrement impossible') }
    finally { setSavingId(null) }
  }
  const complete = async (deleteMissing: boolean) => {
    if (!inventory) return
    setSavingId('complete'); setError('')
    try { await inventoryApi.complete(inventory.id, deleteMissing); await onCompleted() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Clôture impossible') }
    finally { setSavingId(null) }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal inventory-modal" role="dialog" aria-modal="true">
    <div className="modal-head"><div><span className="eyebrow">CONTRÔLE DE COLLECTION</span><h2>Faire l’inventaire</h2></div><button className="icon-button" onClick={onClose} aria-label="Fermer"><X /></button></div>
    {!overview && !error && <div className="inventory-complete"><div className="loader" /><p>Chargement de l’inventaire…</p></div>}
    {overview && !inventory && <><div className="inventory-intro"><ClipboardCheck /><div><strong>Démarrer un nouvel inventaire</strong><p>Un instantané de tous vos exemplaires sera créé. Votre progression sera conservée si vous fermez cette fenêtre.</p></div></div><button className="button primary inventory-start" onClick={() => void start()}>Commencer l’inventaire</button>{overview.history.length > 0 && <InventoryHistory sessions={overview.history} />}</>}
    {inventory && !reviewing && <><div className="inventory-intro"><ClipboardCheck /><div><strong>{inventory.verifiedCount ? 'Inventaire en cours — progression sauvegardée' : 'Vérifiez chaque exemplaire'}</strong><p>Vous pouvez fermer cette fenêtre et reprendre plus tard sans perdre les cases déjà cochées.</p></div></div><div className="inventory-progress"><span>{inventory.verifiedCount} sur {inventory.totalCount} vérifiés</span><strong>{inventory.totalCount ? Math.round(inventory.verifiedCount / inventory.totalCount * 100) : 100}%</strong></div><div className="inventory-progress-bar"><span style={{ width: `${inventory.totalCount ? inventory.verifiedCount / inventory.totalCount * 100 : 100}%` }} /></div><div className="inventory-list">{inventory.items.map((item) => <label className={`inventory-row ${item.status === 'present' ? 'checked' : ''}`} key={item.id}><span className="inventory-thumb">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <Box />}</span><span className="inventory-details"><small>#{item.setNumber} · {item.condition}</small><strong>{item.name}</strong><em>{item.theme || 'Sans thème'}</em></span><input type="checkbox" checked={item.status === 'present'} disabled={Boolean(savingId)} onChange={(event) => void toggle(item.id, event.target.checked)} /><span className="inventory-check"><Check /></span><b>{savingId === item.id ? 'Sauvegarde…' : 'Présent'}</b></label>)}</div><div className="modal-actions"><button className="button ghost" onClick={onClose}>Quitter et reprendre plus tard</button><button className="button primary" disabled={Boolean(savingId)} onClick={() => setReviewing(true)}>Terminer l’inventaire</button></div></>}
    {inventory && reviewing && <><div className={missing.length ? 'inventory-warning' : 'inventory-intro'}>{missing.length ? <Trash2 /> : <Check />}<div><strong>{missing.length ? `${missing.length} set${missing.length > 1 ? 's' : ''} non retrouvé${missing.length > 1 ? 's' : ''}` : 'Collection complète'}</strong><p>{missing.length ? 'Ces sets seront enregistrés comme absents. Vous pouvez les supprimer ou les conserver dans la collection.' : 'Tous les exemplaires ont été retrouvés.'}</p></div></div>{missing.length > 0 && <div className="inventory-missing-list">{missing.map((item) => <div key={item.id}><span>#{item.setNumber}</span><strong>{item.name}</strong></div>)}</div>}<div className="modal-actions"><button className="button ghost" disabled={Boolean(savingId)} onClick={() => setReviewing(false)}>Retour</button>{missing.length > 0 && <button className="button" disabled={Boolean(savingId)} onClick={() => void complete(false)}>Conserver les absents</button>}<button className={missing.length ? 'button danger-button' : 'button primary'} disabled={Boolean(savingId)} onClick={() => void complete(missing.length > 0)}>{savingId ? 'Enregistrement…' : missing.length ? 'Supprimer les absents' : 'Clôturer'}</button></div></>}
    {error && <p className="form-error">{error}</p>}
  </section></div>
}

function InventoryHistory({ sessions }: { sessions: InventorySession[] }) {
  return <div className="inventory-history"><h3><History /> Historique</h3>{sessions.map((session) => <details key={session.id}><summary><span><strong>{new Date(session.completedAt || session.createdAt).toLocaleDateString('fr-FR')}</strong><small>{session.presentCount} présents · {session.absentCount} absents</small></span><b>{session.deletedCount} suppression{session.deletedCount > 1 ? 's' : ''}</b></summary>{session.items.filter((item) => item.deletedFromCollection).map((item) => <div className="inventory-history-item" key={item.id}><span>#{item.setNumber}</span><strong>{item.name}</strong><time>{item.deletedAt ? new Date(item.deletedAt).toLocaleString('fr-FR') : ''}</time></div>)}</details>)}</div>
}
