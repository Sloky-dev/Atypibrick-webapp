import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { brickRoomApi, type Position, type RoomMarker } from '../brickRoomApi'

type Props = { roomId: string; markers: RoomMarker[]; selectedId: string | null; placing: boolean; onPosition: (position: Position) => void; onSelect: (id: string) => void }
type Runtime = { camera: THREE.PerspectiveCamera; controls: OrbitControls; markerGroup: THREE.Group; renderer: THREE.WebGLRenderer; fit: () => void }

export function RoomViewer(props: Props) {
  const host = useRef<HTMLDivElement>(null)
  const latest = useRef(props)
  const runtime = useRef<Runtime | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => { latest.current = props }, [props])

  useEffect(() => {
    const container = host.current
    if (!container) return
    let disposed = false
    let cleanup = () => {}
    setLoaded(false); setError('')
    void (async () => {
      const blob = await brickRoomApi.panorama(props.roomId)
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'flipY' })
      if (disposed) { bitmap.close(); return }
      const renderer = new THREE.WebGLRenderer({ antialias: true })
      const scene = new THREE.Scene()
      const controlsResources: (() => void)[] = []
      cleanup = () => {
        renderer.setAnimationLoop(null)
        controlsResources.forEach((dispose) => dispose())
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose()
            const materials = Array.isArray(object.material) ? object.material : [object.material]
            materials.forEach((material) => {
              for (const value of Object.values(material)) if (value instanceof THREE.Texture) { value.dispose(); if (typeof ImageBitmap !== 'undefined' && value.image instanceof ImageBitmap) value.image.close() }
              material.dispose()
            })
          }
        })
        renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove()
        runtime.current = null
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      const contextLost = (event: Event) => { event.preventDefault(); setLoaded(false); setError('La visite panoramique a été interrompue par le navigateur. Réessayez pour la rouvrir.') }
      renderer.domElement.addEventListener('webglcontextlost', contextLost)
      controlsResources.push(() => renderer.domElement.removeEventListener('webglcontextlost', contextLost))
      renderer.setClearColor('#101310')
      container.appendChild(renderer.domElement)
      const camera = new THREE.PerspectiveCamera(70, 1, .0001, 100)
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.enablePan = false
      controls.enableZoom = false
      controls.rotateSpeed = -.35
      controlsResources.push(() => controls.dispose())
      const texture = new THREE.Texture(bitmap)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.needsUpdate = true
      const geometry = new THREE.SphereGeometry(10, 96, 64)
      geometry.scale(-1, 1, 1)
      const model = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }))
      const wheel = (event: WheelEvent) => {
        event.preventDefault()
        camera.fov = THREE.MathUtils.clamp(camera.fov + event.deltaY * .03, 35, 90)
        camera.updateProjectionMatrix()
      }
      renderer.domElement.addEventListener('wheel', wheel, { passive: false })
      controlsResources.push(() => renderer.domElement.removeEventListener('wheel', wheel))
      scene.add(model)
      if (disposed) { cleanup(); return }
      model.updateMatrixWorld(true)
      const markerGroup = new THREE.Group()
      scene.add(markerGroup)
      const fit = () => {
        controls.target.set(0, 0, 0)
        camera.position.set(.001, 0, 0)
        camera.fov = 70
        camera.updateProjectionMatrix()
        controls.update()
      }
      fit()
      runtime.current = { camera, controls, markerGroup, renderer, fit }
      const resize = new ResizeObserver(() => {
        const width = container.clientWidth, height = container.clientHeight
        renderer.setSize(width, height); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix()
      })
      resize.observe(container); controlsResources.push(() => resize.disconnect())
      const ray = new THREE.Raycaster()
      let downX = 0, downY = 0
      const down = (event: PointerEvent) => { downX = event.clientX; downY = event.clientY }
      const up = (event: PointerEvent) => {
        if (Math.hypot(event.clientX - downX, event.clientY - downY) > 6) return
        const bounds = renderer.domElement.getBoundingClientRect()
        ray.setFromCamera(new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1), camera)
        const marker = ray.intersectObjects(markerGroup.children)[0]
        if (marker && !latest.current.placing) { latest.current.onSelect(marker.object.userData.id as string); return }
        if (!latest.current.placing) return
        const hit = ray.intersectObject(model, true)[0]
        if (hit) {
          const position = hit.point.clone().normalize().multiplyScalar(9.8)
          latest.current.onPosition({ x: position.x, y: position.y, z: position.z })
        }
      }
      renderer.domElement.addEventListener('pointerdown', down)
      renderer.domElement.addEventListener('pointerup', up)
      controlsResources.push(() => { renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointerup', up) })
      renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera) })
      setLoaded(true)
    })().catch((e) => { cleanup(); if (!disposed) setError(e instanceof Error ? e.message : 'Impossible d’ouvrir la visite panoramique sur ce navigateur.') })
    return () => { disposed = true; cleanup() }
  }, [props.roomId, retry])

  useEffect(() => {
    const current = runtime.current
    if (!current || !loaded) return
    for (const child of [...current.markerGroup.children]) {
      const mesh = child as THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
      mesh.geometry.dispose(); mesh.material.dispose(); current.markerGroup.remove(mesh)
    }
    for (const marker of props.markers.filter((value) => value.positioned)) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(marker.id === props.selectedId ? .13 : .09, 12, 8), new THREE.MeshBasicMaterial({ color: marker.id === props.selectedId ? '#ffffff' : '#d2fc54', depthTest: false }))
      mesh.position.set(marker.x, marker.y, marker.z); mesh.userData.id = marker.id; mesh.renderOrder = 1
      current.markerGroup.add(mesh)
    }
  }, [props.markers, props.selectedId, loaded])

  useEffect(() => {
    const current = runtime.current
    const marker = props.markers.find((m) => m.id === props.selectedId)
    if (!current || !marker || !loaded) return
    if (!marker.positioned) return
    current.controls.target.set(0, 0, 0)
    current.camera.position.set(marker.x, marker.y, marker.z).normalize().multiplyScalar(-.001)
    current.controls.update()
  }, [props.selectedId, props.markers, loaded])

  return <div className="room-viewer-wrap"><div className={`room-viewer ${props.placing ? 'placing' : ''}`} ref={host} aria-label="Visite panoramique de la pièce" />
    {!loaded && !error && <div className="room-viewer-overlay" role="status">Chargement de la visite panoramique…</div>}
    {error && <div className="room-viewer-overlay" role="alert"><p>{error}</p><button className="button ghost" onClick={() => setRetry((value) => value + 1)}>Réessayer</button></div>}
    {loaded && <><div className="panorama-zoom"><button aria-label="Zoom avant" onClick={() => { const c = runtime.current?.camera; if (c) { c.fov = Math.max(35, c.fov - 10); c.updateProjectionMatrix() } }}>+</button><button aria-label="Zoom arrière" onClick={() => { const c = runtime.current?.camera; if (c) { c.fov = Math.min(90, c.fov + 10); c.updateProjectionMatrix() } }}>−</button></div><button className="room-reset" onClick={() => runtime.current?.fit()}>Recentrer</button><div className="room-viewer-hint">{props.placing ? 'Touchez un point du meuble pour placer le repère.' : 'Glissez pour regarder autour de vous · boutons + et − pour zoomer'}</div></>}
  </div>
}
