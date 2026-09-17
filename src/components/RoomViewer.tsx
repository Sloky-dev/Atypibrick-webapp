import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
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
      const blob = await brickRoomApi.model(props.roomId)
      const data = await blob.arrayBuffer()
      if (disposed) return
      const renderer = new THREE.WebGLRenderer({ antialias: true })
      const scene = new THREE.Scene()
      const controlsResources: (() => void)[] = []
      cleanup = () => {
        renderer.setAnimationLoop(null)
        controlsResources.forEach((dispose) => dispose())
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
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
      const contextLost = (event: Event) => { event.preventDefault(); setLoaded(false); setError('La vue 3D a été interrompue par le navigateur. Réessayez pour la rouvrir.') }
      renderer.domElement.addEventListener('webglcontextlost', contextLost)
      controlsResources.push(() => renderer.domElement.removeEventListener('webglcontextlost', contextLost))
      renderer.setClearColor('#101310')
      container.appendChild(renderer.domElement)
      const camera = new THREE.PerspectiveCamera(50, 1, .01, 500)
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true; controls.minDistance = .15; controls.maxDistance = 100
      controlsResources.push(() => controls.dispose())
      const isMesh = new DataView(data).getUint32(0, true) === 0x46546c67
      let model: THREE.Object3D
      let pointGeometry: THREE.BufferGeometry | null = null
      if (isMesh) {
        const gltf = await new GLTFLoader().parseAsync(data, '')
        const surface = gltf.scene
        surface.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            const materials = Array.isArray(object.material) ? object.material : [object.material]
            materials.forEach((material) => { material.side = THREE.DoubleSide })
          }
        })
        const bounds = new THREE.Box3().setFromObject(surface)
        const center = bounds.getCenter(new THREE.Vector3())
        const size = bounds.getSize(new THREE.Vector3())
        const scale = 10 / Math.max(size.x, size.y, size.z, .001)
        // Stable normalized world coordinates, shared by rendering and saved markers.
        const normalized = new THREE.Group()
        normalized.add(surface)
        normalized.scale.setScalar(scale)
        normalized.position.copy(center).multiplyScalar(-scale)
        const oriented = new THREE.Group()
        oriented.rotation.x = Math.PI
        oriented.add(normalized)
        model = oriented
        scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 2))
      } else {
        pointGeometry = new PLYLoader().parse(data)
        model = new THREE.Points(pointGeometry, new THREE.PointsMaterial({ size: .035, vertexColors: true, sizeAttenuation: true }))
      }
      scene.add(model)
      if (disposed) { cleanup(); return }
      model.updateMatrixWorld(true)
      const sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere())
      const markerGroup = new THREE.Group()
      scene.add(markerGroup)
      const fit = () => {
        const distance = Math.max(2, sphere.radius * 2.8)
        controls.target.copy(sphere.center)
        camera.position.copy(sphere.center).add(new THREE.Vector3(distance * .3, distance * .2, distance))
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
      ray.params.Points = { threshold: .12 }
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
          const position = pointGeometry && hit.index !== undefined ? new THREE.Vector3().fromBufferAttribute(pointGeometry.getAttribute('position'), hit.index) : hit.point
          latest.current.onPosition({ x: position.x, y: position.y, z: position.z })
        }
      }
      renderer.domElement.addEventListener('pointerdown', down)
      renderer.domElement.addEventListener('pointerup', up)
      controlsResources.push(() => { renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointerup', up) })
      renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera) })
      setLoaded(true)
    })().catch((e) => { cleanup(); if (!disposed) setError(e instanceof Error ? e.message : 'Impossible d’ouvrir la vue 3D sur ce navigateur.') })
    return () => { disposed = true; cleanup() }
  }, [props.roomId, retry])

  useEffect(() => {
    const current = runtime.current
    if (!current || !loaded) return
    for (const child of [...current.markerGroup.children]) {
      const mesh = child as THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
      mesh.geometry.dispose(); mesh.material.dispose(); current.markerGroup.remove(mesh)
    }
    for (const marker of props.markers) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(marker.id === props.selectedId ? .13 : .09, 12, 8), new THREE.MeshBasicMaterial({ color: marker.id === props.selectedId ? '#ffffff' : '#d2fc54', depthTest: false }))
      mesh.position.set(marker.x, marker.y, marker.z); mesh.userData.id = marker.id; mesh.renderOrder = 1
      current.markerGroup.add(mesh)
    }
  }, [props.markers, props.selectedId, loaded])

  useEffect(() => {
    const current = runtime.current
    const marker = props.markers.find((m) => m.id === props.selectedId)
    if (!current || !marker || !loaded) return
    const offset = current.camera.position.clone().sub(current.controls.target).normalize().multiplyScalar(4)
    current.controls.target.set(marker.x, marker.y, marker.z)
    current.camera.position.copy(current.controls.target).add(offset)
    current.controls.update()
  }, [props.selectedId, props.markers, loaded])

  return <div className="room-viewer-wrap"><div className={`room-viewer ${props.placing ? 'placing' : ''}`} ref={host} aria-label="Vue 3D de la pièce" />
    {!loaded && !error && <div className="room-viewer-overlay" role="status">Chargement de la vue 3D…</div>}
    {error && <div className="room-viewer-overlay" role="alert"><p>{error}</p><button className="button ghost" onClick={() => setRetry((value) => value + 1)}>Réessayer</button></div>}
    {loaded && <><button className="room-reset" onClick={() => runtime.current?.fit()}>Vue d’ensemble</button><div className="room-viewer-hint">{props.placing ? 'Touchez un point du meuble pour placer le repère.' : 'Glissez pour tourner · pincez pour zoomer · deux doigts pour déplacer'}</div></>}
  </div>
}
