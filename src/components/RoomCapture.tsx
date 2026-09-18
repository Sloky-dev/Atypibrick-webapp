import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CloudUpload, Pause, ScanLine, Trash2, VideoOff } from 'lucide-react'
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
  const captureLock = useRef(false)
  const scanActive = useRef(false)
  const scanTimer = useRef<number | null>(null)
  const lastScanFrame = useRef<Uint8ClampedArray | null>(null)
  const captureFrame = useRef<(automatic: boolean) => Promise<void>>(async () => {})
  const [scanning, setScanning] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [starting, setStarting] = useState(false)
  const [pending, setPending] = useState<PendingCapture[]>([])
  const [photos, setPhotos] = useState<RoomPhoto[]>([])
  const [reviewPhotos, setReviewPhotos] = useState(false)
  const [reference, setReference] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const pauseScan = useCallback(() => {
    scanActive.current = false
    if (scanTimer.current !== null) window.clearTimeout(scanTimer.current)
    scanTimer.current = null
    setScanning(false)
  }, [])

  const stopCamera = useCallback(() => {
    pauseScan()
    cameraGeneration.current++
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
    if (video.current) video.current.srcObject = null
    setCameraOn(false)
    setCameraStarting(false)
  }, [pauseScan])

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
      if (active.current) {
        pauseScan()
        setError(`${message(e)} Les photos non envoyées restent sur ce téléphone. Utilisez « Reprendre l’envoi ».`)
      }
    } finally { uploadLock.current = false; if (active.current) setUploading(false) }
  }

  async function capture(automatic = false) {
    const source = video.current
    if (!source?.videoWidth || source.readyState < 2 || captureLock.current) return
    if (automatic && !scanActive.current) return
    if (photos.length + pending.length >= capabilities.maxPhotos) {
      pauseScan(); setNotice('Limite de capture atteinte. Vous pouvez assembler le panorama.'); return
    }
    captureLock.current = true
    setCapturing(true)
    if (!automatic) setError('')
    try {
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 1600 / Math.max(source.videoWidth, source.videoHeight))
      canvas.width = Math.round(source.videoWidth * scale); canvas.height = Math.round(source.videoHeight * scale)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('La capture photo n’est pas disponible sur ce navigateur.')
      context.drawImage(source, 0, 0, canvas.width, canvas.height)
      setReference(canvas.toDataURL('image/jpeg', .6))
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      let brightness = 0
      for (let i = 0; i < pixels.length; i += 64) brightness += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3
      if (brightness / Math.ceil(pixels.length / 64) < 25) {
        if (automatic) { setNotice('Image trop sombre : éclairez la zone pour poursuivre le scan.'); return }
        throw new Error('La photo est trop sombre. Éclairez davantage la zone avant de capturer.')
      }
      let signature: Uint8ClampedArray | null = null
      if (automatic) {
        const thumbnail = document.createElement('canvas')
        thumbnail.width = 64; thumbnail.height = 48
        const thumbnailContext = thumbnail.getContext('2d')!
        thumbnailContext.drawImage(canvas, 0, 0, 64, 48)
        signature = thumbnailContext.getImageData(0, 0, 64, 48).data
        const previous = lastScanFrame.current
        if (previous) {
          let difference = 0
          for (let i = 0; i < signature.length; i += 4) {
            difference += Math.abs(signature[i] - previous[i]) + Math.abs(signature[i + 1] - previous[i + 1]) + Math.abs(signature[i + 2] - previous[i + 2])
          }
          if (difference / (64 * 48 * 3) < 3) {
            setNotice('Tournez légèrement : cette vue ressemble à la précédente.'); return
          }
        }
      }
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Échec de la capture photo')), 'image/jpeg', .9))
      if (automatic && !scanActive.current) return
      await captureStore.save({ id: crypto.randomUUID(), roomId: room.id, blob, createdAt: Date.now() })
      if (signature) lastScanFrame.current = signature
      if (!active.current) return
      setPending(await captureStore.list(room.id))
      setNotice(automatic ? 'Image conservée. Tournez lentement sur place, sans changer de zoom.' : 'Photo conservée. Tournez légèrement sur place en conservant les mêmes détails dans le cadre.')
      void uploadPending()
    } catch (e) { if (active.current) { pauseScan(); setError(message(e)) } }
    finally { captureLock.current = false; if (active.current) setCapturing(false) }
  }

  useEffect(() => { captureFrame.current = capture })

  function startScan() {
    if (scanActive.current || !cameraOn) return
    scanActive.current = true; setScanning(true); setError('')
    setNotice('Capture en cours. Tournez sur place à hauteur constante, en gardant les mêmes détails visibles.')
    const next = async () => {
      if (!scanActive.current || !active.current) return
      await captureFrame.current(true)
      if (scanActive.current && active.current) scanTimer.current = window.setTimeout(() => void next(), 1500)
    }
    void next()
  }

  async function removePhoto(photo: RoomPhoto) {
    try { await brickRoomApi.deletePhoto(room.id, photo.id); setPhotos((current) => current.filter((p) => p.id !== photo.id)); onChange(await brickRoomApi.get(room.id)) }
    catch (e) { setError(message(e)) }
  }

  async function startAssembly() {
    setStarting(true); setError('')
    try { stopCamera(); onChange(await brickRoomApi.assemble(room.id)) }
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
    <div className="room-guide"><strong>Tournez sur place pour créer votre panorama</strong><p>Gardez le téléphone vertical, à la même hauteur et au même endroit. Tournez lentement dans un seul sens, sans marcher ni changer de zoom. Gardez environ deux tiers de la vue précédente en commun.</p><p>La dernière photo apparaît en transparence pour vous aider à aligner la suivante. Pour un tour complet, revenez progressivement à votre point de départ. Les zones non photographiées resteront vides, notamment le sol et le plafond.</p></div>
    <div className="room-notice"><label>Importer une photo 360° déjà assemblée<input type="file" accept="image/jpeg,image/png,image/webp" disabled={importing || uploading || scanning || starting || pending.length > 0} onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; stopCamera(); setImporting(true); setError(''); void brickRoomApi.uploadPanorama(room.id, file).then(onChange).catch((e) => setError(message(e))).finally(() => setImporting(false)); event.target.value = '' }} /></label><p>Image équirectangulaire 2:1, jusqu’à 30 Mo. Une photo ordinaire ne suffit pas.</p>{importing && <p role="status">Envoi du panorama…</p>}</div>
    <div className="room-camera">{cameraOn && reference && <img className="panorama-reference" src={reference} alt="Dernière vue : alignez les détails communs" />}<video ref={video} playsInline muted aria-label="Aperçu de la caméra" />{!cameraOn && <div className="room-camera-cover"><Camera size={36} /><p>Capturez votre espace directement ici.</p><button className="button primary" disabled={cameraStarting} onClick={() => void startCamera()}>{cameraStarting ? 'Ouverture…' : 'Ouvrir la caméra'}</button></div>}{cameraOn && <div className="room-camera-guide" aria-hidden="true" />}</div>
    <div className="room-toolbar"><span aria-live="polite"><strong>{photos.length}</strong> photos envoyées{pending.length > 0 && ` · ${pending.length} en attente`}{scanning && ' · Scan en cours'}</span>{cameraOn && <><button className="button primary" disabled={!scanning && (capturing || photos.length + pending.length >= capabilities.maxPhotos || starting)} onClick={scanning ? pauseScan : startScan}>{scanning ? <Pause size={18} /> : <ScanLine size={18} />}{scanning ? 'Mettre la capture en pause' : 'Démarrer la capture continue'}</button><button className="button ghost" disabled={scanning || capturing || photos.length + pending.length >= capabilities.maxPhotos || starting} onClick={() => void capture()}><Camera size={18} />{capturing && !scanning ? 'Capture…' : 'Prendre une photo'}</button><button className="button ghost" onClick={stopCamera}><VideoOff size={18} /> Arrêter la caméra</button></>}</div>
    {cameraOn && <p className="room-muted">Le scan conserve des images extraites de la caméra. Aucun fichier vidéo ni son n’est enregistré.</p>}
    {notice && <p className="room-muted" role="status">{notice}</p>}
    {error && <p className="room-error" role="alert">{error}</p>}
    {pending.length > 0 && <div className="room-toolbar"><button className="button ghost" disabled={uploading} onClick={() => void uploadPending()}><CloudUpload size={18} />{uploading ? 'Envoi en cours…' : 'Reprendre l’envoi'}</button><button className="button ghost" disabled={uploading || capturing || scanning} onClick={() => void discardPending()}>Supprimer les photos en attente</button><small>Les photos en attente restent sur ce téléphone, même si vous fermez cette page.</small></div>}
    {photos.length > 0 && <details className="room-photo-review" onToggle={(e) => setReviewPhotos(e.currentTarget.open)}><summary>Vérifier les {photos.length} photos envoyées</summary>{reviewPhotos && <div className="room-photos">{photos.map((photo) => <PhotoTile key={photo.id} roomId={room.id} photo={photo} onRemove={() => void removePhoto(photo)} />)}</div>}</details>}
    {!capabilities.workerAvailable && <p className="room-notice">L’assemblage est actuellement indisponible. L’import d’un panorama 360° reste possible.</p>}
    <div className="room-toolbar"><button className="button primary" disabled={photos.length < capabilities.minPhotos || pending.length > 0 || uploading || capturing || scanning || starting || !capabilities.workerAvailable} onClick={() => void startAssembly()}>{starting ? 'Démarrage…' : 'Assembler le panorama'}</button><small>Au moins {capabilities.minPhotos} photos · jusqu’à {capabilities.maxPhotos}. Mettez la capture en pause avant d’assembler le panorama.</small></div>
  </div>
}
