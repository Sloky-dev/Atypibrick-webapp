import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Box, Camera, MapPin, Plus, Search, Trash2, X } from 'lucide-react'
import { collectionApi } from '../api'
import { brickRoomApi, type Position, type Room, type RoomCapabilities, type RoomLocation, type RoomMarker } from '../brickRoomApi'
import type { LegoSet } from '../types'
import { captureStore } from '../roomCaptureStore'
import { RoomCapture } from './RoomCapture'
import './brickRooms.css'

const RoomViewer = lazy(() => import('./RoomViewer').then((module) => ({ default: module.RoomViewer })))

const errorMessage = (e: unknown) => e instanceof Error ? e.message : 'Une erreur est survenue.'
const statusLabel: Record<Room['status'], string> = { capture: 'Capture', queued: 'En attente', processing: 'Reconstruction', ready: 'Vue 3D disponible', failed: 'À reprendre' }
const roomStatus = (room: Room) => room.status === 'ready' && room.modelFormat !== 'mesh' ? 'Ancienne reconstruction partielle' : statusLabel[room.status]

function SetSearch({ onChoose, disabled }: { onChoose: (id: string) => void; disabled: boolean }) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<LegoSet[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true); setError('')
      void collectionApi.list(query.trim(), null, 20).then((page) => { if (active) setItems(page.items) }).catch((e) => { if (active) setError(errorMessage(e)) }).finally(() => { if (active) setLoading(false) })
    }, 300)
    return () => { active = false; window.clearTimeout(timer) }
  }, [query])
  return <div className="room-set-search"><label><Search size={16} /><input value={query} maxLength={120} placeholder="Nom ou numéro du set…" aria-label="Rechercher un set à ranger" onChange={(e) => setQuery(e.target.value)} /></label>{error && <p role="alert">{error}</p>}{loading && <p>Recherche…</p>}<div>{items.map((item) => <button disabled={disabled || loading} key={item.id} onClick={() => onChoose(item.id)}><span><strong>{item.name}</strong><small>#{item.setNumber} · {item.brand}{item.purchaseDate ? ` · ${item.purchaseDate}` : ''} · exemplaire {item.id.slice(0, 8)}</small></span><Plus size={16} /></button>)}</div>{!loading && !items.length && <p>Aucun set trouvé.</p>}<small>Affichage des 20 premiers résultats. Précisez la recherche pour retrouver un autre set.</small></div>
}

function RoomDetail({ initialRoom, capabilities, initialMarker, onBack, onUpdated }: { initialRoom: Room; capabilities: RoomCapabilities; initialMarker: string | null; onBack: () => void; onUpdated: () => void }) {
  const [room, setRoom] = useState(initialRoom)
  const [markers, setMarkers] = useState<RoomMarker[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(initialMarker)
  const [placing, setPlacing] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const selected = markers.find((marker) => marker.id === selectedId)
  const updateRoom = (value: Room) => { setRoom(value); onUpdated() }

  useEffect(() => {
    if (room.status !== 'queued' && room.status !== 'processing') return
    let active = true
    const timer = window.setInterval(() => {
      void brickRoomApi.get(room.id).then((value) => { if (active) { setRoom(value); setError('') } }).catch((e) => { if (active) setError(errorMessage(e)) })
    }, 4000)
    return () => { active = false; window.clearInterval(timer) }
  }, [room.id, room.status])
  useEffect(() => {
    if (room.status !== 'ready') return
    let active = true
    void brickRoomApi.markers(room.id).then((value) => { if (active) setMarkers(value) }).catch((e) => { if (active) setError(errorMessage(e)) })
    return () => { active = false }
  }, [room.id, room.status])

  async function mutate(action: () => Promise<unknown>) {
    setBusy(true); setError('')
    try { await action(); setMarkers(await brickRoomApi.markers(room.id)) }
    catch (e) { setError(errorMessage(e)) }
    finally { setBusy(false) }
  }
  async function saveMarker() {
    if (!position || !label.trim()) return
    await mutate(async () => {
      const marker = await brickRoomApi.createMarker(room.id, label.trim(), position)
      setSelectedId(marker.id); setPosition(null); setPlacing(false); setLabel('')
    })
  }
  async function deleteRoom() {
    if (!confirm(`Supprimer « ${room.name} », ses photos, sa vue 3D et ses repères ? Les sets resteront dans votre collection.`)) return
    setBusy(true)
    try {
      await brickRoomApi.remove(room.id)
      for (const capture of await captureStore.list(room.id)) await captureStore.remove(capture.id)
      onUpdated(); onBack()
    } catch (e) { setError(errorMessage(e)); setBusy(false) }
  }

  async function reopen() {
    setBusy(true); setError('')
    try { updateRoom(await brickRoomApi.reopen(room.id)) }
    catch (e) { setError(errorMessage(e)) }
    finally { setBusy(false) }
  }

  return <section className="room-detail"><button className="room-back" onClick={onBack}><ArrowLeft size={16} /> Mes pièces</button><div className="room-heading"><div><span className="eyebrow">BRICK ROOM</span><h1>{room.name}</h1><p>{roomStatus(room)} · {room.photoCount} photos</p></div><button className="button ghost" disabled={busy || room.status === 'processing'} onClick={() => void deleteRoom()}><Trash2 size={16} /> Supprimer</button></div>
    {error && <p className="room-error" role="alert">{error}</p>}
    {room.error && <p className="room-error" role="alert">{room.error}</p>}
    {(room.status === 'capture' || room.status === 'failed') && <RoomCapture room={room} capabilities={capabilities} onChange={updateRoom} />}
    {(room.status === 'queued' || room.status === 'processing') && <div className="room-processing" role="status"><div className="loader" /><h2>{room.stage}</h2><p>La reconstruction peut prendre plusieurs minutes. Vous pouvez quitter cette page et revenir plus tard.</p>{!capabilities.workerAvailable && <p>Le traitement est momentanément indisponible. Votre capture est conservée.</p>}</div>}
    {room.status === 'ready' && room.modelFormat === 'mesh' && <div className="room-notice"><button className="button primary" disabled={busy || markers.length > 0} onClick={() => void reopen()}>Compléter et reconstruire</button><p>{markers.length > 0 ? 'La reconstruction déplacerait les repères. Supprimez les emplacements avant de relancer, ou créez une nouvelle capture pour les conserver.' : 'Vos photos sont conservées. Vous pourrez relancer le calcul sans prendre de nouvelles photos.'}</p></div>}
    {room.status === 'ready' && <>{room.modelFormat === 'mesh' ? <p className="room-notice">Surfaces texturées · {room.registeredImages}/{room.photoCount} photos reliées. Les dimensions ne sont pas calibrées.</p> : <div className="room-notice"><strong>Cette ancienne reconstruction ne contient que des points de repérage.</strong><p>{room.registeredImages}/{room.photoCount} photos reliées. Pour obtenir des surfaces, complétez les vues manquantes et relancez la reconstruction. Vos photos sont conservées.</p><button className="button primary" disabled={busy || markers.length > 0} onClick={() => void reopen()}>Compléter et reconstruire</button>{markers.length > 0 && <p>Créez une nouvelle capture pour conserver les positions de vos repères existants.</p>}</div>}<div className="room-workspace"><div><Suspense fallback={<div className="room-viewer" role="status">Ouverture de la vue 3D…</div>}><RoomViewer roomId={room.id} markers={markers} selectedId={selectedId} placing={placing} onPosition={setPosition} onSelect={setSelectedId} /></Suspense>
      <div className="room-toolbar"><button disabled={room.modelFormat !== 'mesh'} className={`button ${placing ? 'ghost' : 'primary'}`} onClick={() => { setPlacing(!placing); setPosition(null) }}><MapPin size={16} />{placing ? 'Annuler le placement' : 'Ajouter un emplacement'}</button></div>
      {placing && <form className="room-marker-form" onSubmit={(e) => { e.preventDefault(); void saveMarker() }}><label>Nom de l’emplacement<input value={label} maxLength={100} required placeholder="Vitrine · Étagère du haut" onChange={(e) => setLabel(e.target.value)} /></label><p>{position ? 'Position choisie. Vous pouvez toucher un autre point pour la modifier.' : 'Touchez un point du meuble dans la vue 3D.'}</p><button className="button primary" disabled={!position || !label.trim() || busy}>Enregistrer le repère</button></form>}
    </div><aside className="room-locations"><h2>Mes emplacements</h2>{!markers.length && <p>Ajoutez un repère sur le meuble, puis associez-lui les sets qui y sont rangés.</p>}<div className="room-marker-list">{markers.map((marker) => <button className={selectedId === marker.id ? 'selected' : ''} key={marker.id} onClick={() => setSelectedId(marker.id)}><MapPin size={16} /><span>{marker.label}<small>{marker.sets.length} set{marker.sets.length > 1 ? 's' : ''}</small></span></button>)}</div>
      {selected && <div className="room-selected"><div className="room-toolbar"><h3>{selected.label}</h3><button aria-label="Supprimer cet emplacement" disabled={busy} onClick={() => { if (confirm('Supprimer ce repère et ses associations ? Les sets restent dans la collection.')) void mutate(() => brickRoomApi.deleteMarker(room.id, selected.id)) }}><Trash2 size={16} /></button></div>
        <ul className="room-assigned">{selected.sets.map((item) => <li key={item.id}><span>{item.name}<small>#{item.setNumber}</small></span><button disabled={busy} aria-label={`Retirer ${item.name} de cet emplacement`} onClick={() => void mutate(() => brickRoomApi.unplace(room.id, selected.id, item.id))}><X size={16} /></button></li>)}</ul><h3>Ranger un set ici</h3><SetSearch disabled={busy} onChoose={(setId) => void mutate(() => brickRoomApi.place(room.id, selected.id, setId))} />
      </div>}
    </aside></div></>}
  </section>
}

export function BrickRooms({ locateSet }: { locateSet: LegoSet | null }) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [capabilities, setCapabilities] = useState<RoomCapabilities>({ workerAvailable: false, minPhotos: 12, maxPhotos: 100 })
  const [selected, setSelected] = useState<{ room: Room; marker: string | null } | null>(null)
  const [locations, setLocations] = useState<RoomLocation[] | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(async () => {
    try { const [values, available] = await Promise.all([brickRoomApi.list(), brickRoomApi.capabilities()]); setRooms(values); setCapabilities(available); setError('') }
    catch (e) { setError(errorMessage(e)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 15000); return () => window.clearInterval(timer) }, [refresh])
  useEffect(() => {
    let active = true
    if (!locateSet) return
    setSelected(null); setLocations(null)
    void brickRoomApi.locations(locateSet.id).then(async (values) => {
      if (!active) return
      setLocations(values)
      if (values.length === 1) {
        const room = await brickRoomApi.get(values[0].roomId)
        if (active) setSelected({ room, marker: values[0].markerId })
      }
    }).catch((e) => { if (active) setError(errorMessage(e)) })
    return () => { active = false }
  }, [locateSet])

  async function create() {
    setBusy(true); setError('')
    try { const room = await brickRoomApi.create(name.trim()); setName(''); setSelected({ room, marker: null }); void refresh() }
    catch (e) { setError(errorMessage(e)) }
    finally { setBusy(false) }
  }
  async function openLocation(location: RoomLocation) {
    try { setSelected({ room: await brickRoomApi.get(location.roomId), marker: location.markerId }) }
    catch (e) { setError(errorMessage(e)) }
  }

  if (selected) return <RoomDetail key={selected.room.id} initialRoom={selected.room} initialMarker={selected.marker} capabilities={capabilities} onBack={() => { setSelected(null); void refresh() }} onUpdated={() => void refresh()} />
  return <section className="brick-rooms"><div className="room-heading"><div><span className="eyebrow">VOTRE COLLECTION, À SA PLACE</span><h1>Brick Room<span>.</span></h1><p>Capturez votre espace. Explorez-le en 3D. Retrouvez chaque set.</p></div><Box size={54} /></div>
    {error && <p className="room-error" role="alert">{error}<button onClick={() => void refresh()}>Réessayer</button></p>}
    {locateSet && <div className="room-notice"><strong>Localiser {locateSet.name}</strong>{locations === null ? <p>Recherche des emplacements…</p> : locations.length ? locations.map((location) => <button key={location.markerId} className="room-location-link" onClick={() => void openLocation(location)}><MapPin size={16} />{location.roomName} → {location.label}</button>) : <p>Ce set n’a pas encore d’emplacement. Ouvrez une pièce, sélectionnez un repère et associez-y ce set.</p>}</div>}
    <div className="room-intro"><Camera size={28} /><div><h2>Votre première capture</h2><p>Commencez par une étagère bien éclairée. Scannez-la sous plusieurs angles : Atypibrick utilise les vues qui se recouvrent pour reconstruire ses surfaces et y appliquer les photos.</p></div></div>
    <form className="room-create" onSubmit={(e) => { e.preventDefault(); void create() }}><label>Nom de la pièce ou du meuble<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bureau · Bibliothèque" required maxLength={100} /></label><button className="button primary" disabled={busy || !name.trim()}><Plus size={18} />{busy ? 'Création…' : 'Nouvelle capture'}</button></form>
    <h2>Mes pièces</h2>{loading ? <p>Chargement…</p> : !rooms.length ? <div className="room-empty"><MapPin size={28} /><p>Votre prochain repère commence par une capture.</p></div> : <div className="room-grid">{rooms.map((room) => <button key={room.id} className="room-card" onClick={() => setSelected({ room, marker: null })}><Box size={30} /><span className={`room-status ${room.status}`}>{roomStatus(room)}</span><h3>{room.name}</h3><p>{room.photoCount} photos{room.modelFormat === 'mesh' && ' · surfaces texturées'}</p><span>{room.status === 'ready' ? 'Voir la reconstruction →' : room.status === 'capture' || room.status === 'failed' ? 'Reprendre la capture →' : 'Voir la progression →'}</span></button>)}</div>}
  </section>
}
