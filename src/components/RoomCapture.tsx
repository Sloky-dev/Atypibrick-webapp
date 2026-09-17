import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CloudUpload, Trash2, VideoOff } from 'lucide-react'
import { brickRoomApi, type Room, type RoomCapabilities, type RoomPhoto } from '../brickRoomApi'
import { captureStore, type PendingCapture } from '../roomCaptureStore'

const message = (error: unknown) => error instanceof Error ? error.message : 'Une erreur est survenue.'

function PhotoTile({ roomId, photo, onRemove }: { roomId: string; photo: RoomPhoto; onRemove: () => void }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let active = true
    let objectUrl = ''
    void brickRoomApi.photo(roomId, photo.id).then((blob) => {
      if (active) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl) }
    }).catch(() => {})
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [roomId, photo.id])
  return <div className="room-photo">{url ? <img src={url} alt="Photo de la capture" /> : <span>Photo</span>}<button aria-label="Supprimer cette photo" onClick={onRemove}><Trash2 size={14} /></button></div>
}

export function RoomCapture({ room, capabilities, onChange }: { room: Room; capabilities: RoomCapabilities; onChange: (room: Room) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const active = useRef(true)
  const cameraGeneration = useRef(0)
  const uploadLock = useRef(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [starting, setStarting] = useState(false)
  const [pending, setPending] = useState<PendingCapture[]>([])
  const [photos, setPhotos] = useState<RoomPhoto[]>([])
  const [reviewPhotos, setReviewPhotos] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const stopCamera = useCallback(() => {
    cameraGeneration.current++
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
    if (video.current) video.current.srcObject = null
    setCameraOn(false)
    setCameraStarting(false)
  }, [])

  useEffect(() => {
    active.current = true
    void Promise.all([brickRoomApi.photos(room.id), captureStore.list(room.id)]).then(([saved, waiting]) => {
      if (active.current) { setPhotos(saved); setPending(waiting) }
    }).catch((e) => { if (active.current) setError(message(e)) })
    const hide = () => { if (document.hidden) stopCamera() }
    document.addEventListener('visibilitychange', hide)
    return () => { active.current = false; stopCamera(); document.removeEventListener('visibilitychange', hide) }
  }, [room.id, stopCamera])

  async function startCamera() {
    setError(''); setCameraStarting(true)
    const generation = ++cameraGeneration.current
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('La caméra nécessite une connexion HTTPS et un navigateur compatible, comme Chrome sur Android.')
      const next = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
      if (!active.current || generation !== cameraGeneration.current) { next.getTracks().forEach((track) => track.stop()); return }
      stream.current = next
      if (video.current) { video.current.srcObject = next; await video.current.play() }
      setCameraOn(true)
    } catch (e) {
      if (generation !== cameraGeneration.current) return
      stopCamera()
      setError(e instanceof DOMException && e.name === 'NotAllowedError' ? 'Autorisez la caméra dans les paramètres du site, puis réessayez.' : message(e))
    } finally { if (active.current) setCameraStarting(false) }
  }

  async function uploadPending() {
    if (uploadLock.current) return
    uploadLock.current = true; setUploading(true); setError('')
    try {
      while (active.current) {
        const waiting = await captureStore.list(room.id)
        setPending(waiting)
        if (!waiting.length) break
        const item = waiting[0]
        const saved = await brickRoomApi.upload(room.id, item.id, item.blob)
        await captureStore.remove(item.id)
        if (!active.current) break
        setPhotos((current) => current.some((p) => p.id === saved.id) ? current : [...current, saved])
      }
      if (active.current) onChange(await brickRoomApi.get(room.id))
    } catch (e) {
      if (active.current) setError(`${message(e)} Les photos non envoyées restent sur ce téléphone. Utilisez « Reprendre l’envoi ».`)
    } finally { uploadLock.current = false; if (active.current) setUploading(false) }
  }

  async function capture() {
    const source = video.current
    if (!source?.videoWidth || capturing) return
    setCapturing(true); setError('')
    try {
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 1600 / Math.max(source.videoWidth, source.videoHeight))
      canvas.width = Math.round(source.videoWidth * scale); canvas.height = Math.round(source.videoHeight * scale)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('La capture photo n’est pas disponible sur ce navigateur.')
      context.drawImage(source, 0, 0, canvas.width, canvas.height)
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      let brightness = 0
      for (let i = 0; i < pixels.length; i += 64) brightness += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3
      if (brightness / Math.ceil(pixels.length / 64) < 25) throw new Error('La photo est trop sombre. Éclairez davantage la zone avant de capturer.')
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Échec de la capture photo')), 'image/jpeg', .9))
      await captureStore.save({ id: crypto.randomUUID(), roomId: room.id, blob, createdAt: Date.now() })
      setPending(await captureStore.list(room.id))
      setNotice('Photo conservée. Faites un petit pas de côté en gardant le meuble dans le cadre.')
      void uploadPending()
    } catch (e) { setError(message(e)) }
    finally { setCapturing(false) }
  }

  async function removePhoto(photo: RoomPhoto) {
    try { await brickRoomApi.deletePhoto(room.id, photo.id); setPhotos((current) => current.filter((p) => p.id !== photo.id)); onChange(await brickRoomApi.get(room.id)) }
    catch (e) { setError(message(e)) }
  }

  async function startReconstruction() {
    setStarting(true); setError('')
    try { stopCamera(); onChange(await brickRoomApi.reconstruct(room.id)) }
    catch (e) { setError(message(e)) }
    finally { setStarting(false) }
  }

  async function discardPending() {
    if (!confirm('Supprimer les photos encore en attente sur ce téléphone ? Les photos déjà envoyées seront conservées.')) return
    try {
      for (const item of await captureStore.list(room.id)) await captureStore.remove(item.id)
      setPending([]); setError('')
    } catch (e) { setError(message(e)) }
  }

  return <div className="room-capture">
    <div className="room-guide"><strong>Commencez par une étagère ou un coin de pièce</strong><p>Prenez 20 à 40 photos nettes. Déplacez-vous autour du meuble, avec environ deux tiers de l’image en commun entre deux photos. Gardez le même zoom et changez aussi légèrement de hauteur.</p><p>Éclairez la zone, ouvrez les vitrines si possible et évitez les miroirs. Tourner le téléphone sur place ne suffit pas : déplacez-vous pour capturer le relief.</p></div>
    <div className="room-camera"><video ref={video} playsInline muted aria-label="Aperçu de la caméra" />{!cameraOn && <div className="room-camera-cover"><Camera size={36} /><p>Capturez votre espace directement ici.</p><button className="button primary" disabled={cameraStarting} onClick={() => void startCamera()}>{cameraStarting ? 'Ouverture…' : 'Ouvrir la caméra'}</button></div>}{cameraOn && <div className="room-camera-guide" aria-hidden="true" />}</div>
    <div className="room-toolbar"><span aria-live="polite"><strong>{photos.length}</strong> photos envoyées{pending.length > 0 && ` · ${pending.length} en attente`}</span>{cameraOn && <><button className="button primary" disabled={capturing || photos.length + pending.length >= capabilities.maxPhotos || starting} onClick={() => void capture()}><Camera size={18} />{capturing ? 'Capture…' : 'Prendre une photo'}</button><button className="button ghost" onClick={stopCamera}><VideoOff size={18} /> Arrêter la caméra</button></>}</div>
    {notice && <p className="room-muted" role="status">{notice}</p>}
    {error && <p className="room-error" role="alert">{error}</p>}
    {pending.length > 0 && <div className="room-toolbar"><button className="button ghost" disabled={uploading} onClick={() => void uploadPending()}><CloudUpload size={18} />{uploading ? 'Envoi en cours…' : 'Reprendre l’envoi'}</button><button className="button ghost" disabled={uploading || capturing} onClick={() => void discardPending()}>Supprimer les photos en attente</button><small>Les photos en attente restent sur ce téléphone, même si vous fermez cette page.</small></div>}
    {photos.length > 0 && <details className="room-photo-review" onToggle={(e) => setReviewPhotos(e.currentTarget.open)}><summary>Vérifier les {photos.length} photos envoyées</summary>{reviewPhotos && <div className="room-photos">{photos.map((photo) => <PhotoTile key={photo.id} roomId={room.id} photo={photo} onRemove={() => void removePhoto(photo)} />)}</div>}</details>}
    {!capabilities.workerAvailable && <p className="room-notice">Le traitement 3D est actuellement indisponible. Vous pouvez capturer vos photos et revenir lancer la reconstruction plus tard.</p>}
    <div className="room-toolbar"><button className="button primary" disabled={photos.length < capabilities.minPhotos || pending.length > 0 || uploading || capturing || starting || !capabilities.workerAvailable} onClick={() => void startReconstruction()}>{starting ? 'Démarrage…' : 'Construire la vue 3D'}</button><small>Au moins {capabilities.minPhotos} photos · jusqu’à {capabilities.maxPhotos}. Vous pourrez quitter la page pendant le traitement.</small></div>
  </div>
}
