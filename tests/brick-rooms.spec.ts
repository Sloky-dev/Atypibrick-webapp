import { test, expect, type Page } from '@playwright/test'

const set = { id: 'set-1', name: 'Millennium Falcon', setNumber: '75192', brand: 'LEGO', theme: 'Star Wars', imageUrl: '/media/atypibrick/sets/test.jpg?v=1', numParts: 7541, purchasePrice: '500', totalInvested: '500', replacementCost: '0', condition: 'Neuf', missingPartsCount: 0, notes: '', isGift: false, isSealed: false }
const pointCloud = () => {
  const points: string[] = []
  for (let x = -30; x <= 30; x++) for (let y = -30; y <= 30; y++) points.push(`${x / 10} ${y / 10} 0 160 200 80`)
  return `ply\nformat ascii 1.0\nelement vertex ${points.length}\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n${points.join('\n')}`
}

const texturedModel = () => {
  const positions = Buffer.from(new Float32Array([-3, -3, 0, 3, -3, 0, 3, 3, 0, -3, 3, 0]).buffer)
  const indices = Buffer.from(new Uint16Array([0, 1, 2, 0, 2, 3]).buffer)
  const uv = Buffer.from(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]).buffer)
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAKklEQVR4nGN0S2liwAaKdW9gFWdiIBEwjWogArDgCu/eyxpDxQ9Mw0ADAJIrBcZUoQWVAAAAAElFTkSuQmCC', 'base64')
  const binary = Buffer.concat([positions, indices, uv, png])
  const gltf = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    buffers: [{ byteLength: binary.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.length }, { buffer: 0, byteOffset: positions.length, byteLength: indices.length }, { buffer: 0, byteOffset: positions.length + indices.length, byteLength: uv.length }, { buffer: 0, byteOffset: positions.length + indices.length + uv.length, byteLength: png.length }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 4, type: 'VEC3', min: [-3, -3, 0], max: [3, 3, 0] }, { bufferView: 1, componentType: 5123, count: 6, type: 'SCALAR' }, { bufferView: 2, componentType: 5126, count: 4, type: 'VEC2' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 2 }, indices: 1, material: 0 }] }],
    materials: [{ doubleSided: true, pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 } }],
    textures: [{ source: 0 }], images: [{ bufferView: 3, mimeType: 'image/png' }] }
  const json = Buffer.from(JSON.stringify(gltf))
  const paddedJson = Buffer.concat([json, Buffer.alloc((-json.length >>> 0) % 4, 32)])
  const paddedBinary = Buffer.concat([binary, Buffer.alloc((-binary.length >>> 0) % 4)])
  const header = Buffer.alloc(20)
  header.write('glTF'); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + paddedJson.length + paddedBinary.length, 8); header.writeUInt32LE(paddedJson.length, 12); header.writeUInt32LE(0x4e4f534a, 16)
  const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(paddedBinary.length, 0); binHeader.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([header, paddedJson, binHeader, paddedBinary])
}

async function setup(page: Page, options: { failUpload?: boolean; workerAvailable?: boolean; legacy?: boolean; readyMesh?: boolean } = {}) {
  let room: Record<string, unknown> | null = null
  const photos: { id: string; captureId: string }[] = []
  let markers: { id: string; label: string; x: number; y: number; z: number; sets: typeof set[] }[] = []
  let failUpload = options.failUpload ?? false
  let lastPhoto = Buffer.alloc(0)
  await page.route('**/api/atypibrick/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/api/atypibrick/v1', '')
    const method = request.method()
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (path === '/auth/me') return json({ email: 'test@example.org' })
    if (path === '/collection/summary') return json({ itemCount: 1, setCount: 1, totalParts: 7541, totalInvested: '500', brands: [], themes: [], conditions: [], purchaseYears: [] })
    if (path === '/collection') return json({ items: [set], hasMore: false, nextCursor: null })
    if (path === '/rooms/capabilities') return json({ workerAvailable: options.workerAvailable ?? true, minPhotos: 2, maxPhotos: 100 })
    if (path === '/rooms' && method === 'GET') return json(room ? [room] : [])
    if (path === '/rooms' && method === 'POST') {
      room = { id: 'room-1', name: request.postDataJSON().name, status: 'capture', stage: 'Capture', error: null, photoCount: 0, pointCount: 0, registeredImages: 0, createdAt: new Date().toISOString() }
      if (options.legacy || options.readyMesh) {
        for (let i = 0; i < 21; i++) photos.push({ id: `photo-${i}`, captureId: `capture-${i}` })
        room = { ...room, status: 'ready', modelFormat: options.readyMesh ? 'mesh' : 'points', photoCount: 21, registeredImages: 11, pointCount: 1990 }
      }
      return json(room, 201)
    }
    if (path.startsWith('/rooms/locations/')) return json(markers.filter((m) => m.sets.length).map((m) => ({ roomId: 'room-1', roomName: 'Bureau', markerId: m.id, label: m.label })))
    if (path === '/rooms/room-1' && method === 'GET') return json(room)
    if (path === '/rooms/room-1/photos' && method === 'GET') return json(photos)
    if (path.startsWith('/rooms/room-1/photos/') && method === 'PUT') {
      if (failUpload) { failUpload = false; return route.abort('internetdisconnected') }
      const captureId = path.split('/').pop()!
      const existing = photos.find((p) => p.captureId === captureId)
      if (existing) return json(existing)
      lastPhoto = request.postDataBuffer()!
      const photo = { id: `photo-${photos.length}`, captureId }
      photos.push(photo); room!.photoCount = photos.length
      return json(photo)
    }
    if (path.startsWith('/rooms/room-1/photos/') && method === 'GET') return route.fulfill({ contentType: 'image/jpeg', body: lastPhoto })
    if (path === '/rooms/room-1/reconstruct') {
      room = { ...room!, status: 'ready', modelFormat: 'mesh', stage: 'Vue 3D disponible', registeredImages: photos.length, pointCount: 3721 }
      return json({ ...room, status: 'queued', stage: 'En attente de traitement' })
    }
    if (path === '/rooms/room-1/reopen') { room = { ...room, status: 'capture' }; return json(room) }
    if (path === '/rooms/room-1/model') return room?.modelFormat === 'points' ? route.fulfill({ contentType: 'application/octet-stream', body: pointCloud() }) : route.fulfill({ contentType: 'model/gltf-binary', body: texturedModel() })
    if (path === '/rooms/room-1/markers' && method === 'GET') return json(markers)
    if (path === '/rooms/room-1/markers' && method === 'POST') {
      const marker = { ...request.postDataJSON(), id: 'marker-1', sets: [] }
      markers.push(marker); return json(marker, 201)
    }
    if (path === '/rooms/room-1/markers/marker-1/sets/set-1') {
      markers = markers.map((m) => ({ ...m, sets: method === 'PUT' ? [set] : [] }))
      return route.fulfill({ status: 204 })
    }
    return json({ detail: `Unhandled test route ${method} ${path}` }, 404)
  })
  await page.goto('/')
  await navigate(page, 'Brick Room')
  await page.getByLabel('Nom de la pièce ou du meuble').fill('Bureau')
  await page.getByRole('button', { name: 'Nouvelle capture' }).click()
  await expect(page.getByRole('heading', { name: 'Bureau', exact: true })).toBeVisible()
}

async function navigate(page: Page, name: string) {
  await expect(page.getByRole('navigation')).toBeAttached()
  const menu = page.getByRole('button', { name: 'Ouvrir le menu' })
  if (await menu.isVisible()) await menu.click()
  await page.getByRole('navigation').getByText(name, { exact: true }).click()
}

test('capture, reconstruction display, marker, set association and locate', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (entry) => { if (entry.type() === 'error' && entry.text().includes('THREE.')) errors.push(entry.text()) })
  await setup(page)
  await page.getByRole('button', { name: 'Ouvrir la caméra' }).click()
  await page.getByRole('button', { name: 'Prendre une photo' }).click()
  await expect(page.getByText('Vérifier les 1 photos envoyées')).toBeVisible()
  await page.getByRole('button', { name: 'Prendre une photo' }).click()
  await expect(page.getByText('Vérifier les 2 photos envoyées')).toBeVisible()
  await page.getByRole('button', { name: 'Construire la vue 3D' }).click()
  await expect(page.getByText('Surfaces texturées', { exact: false })).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: 'Vue d’ensemble' })).toBeVisible()
  await page.getByRole('button', { name: 'Ajouter un emplacement' }).click()
  await page.getByLabel('Nom de l’emplacement').fill('Étagère du haut')
  const canvas = page.locator('.room-viewer canvas')
  const bounds = await canvas.boundingBox()
  await canvas.click({ position: { x: bounds!.width / 2, y: bounds!.height / 2 } })
  await expect(page.getByRole('button', { name: 'Enregistrer le repère' })).toBeEnabled()
  await page.getByRole('button', { name: 'Enregistrer le repère' }).click()
  await page.getByRole('button', { name: /Millennium Falcon.*75192/ }).click()
  await expect(page.locator('.room-assigned')).toContainText('Millennium Falcon')
  await page.screenshot({ path: test.info().outputPath('brick-room.png'), fullPage: true })
  await navigate(page, 'Ma collection')
  await page.getByRole('button', { name: 'Localiser Millennium Falcon' }).click()
  await expect(page.getByRole('heading', { name: 'Bureau', exact: true })).toBeVisible()
  await expect(page.locator('.room-marker-list .selected')).toContainText('Étagère du haut')
  expect(errors).toEqual([])
})

test('failed upload survives page reload and retries without recapture', async ({ page }) => {
  await setup(page, { failUpload: true })
  await page.getByRole('button', { name: 'Ouvrir la caméra' }).click()
  await page.getByRole('button', { name: 'Prendre une photo' }).click()
  await expect(page.getByRole('button', { name: 'Reprendre l’envoi' })).toBeVisible()
  await page.reload()
  await navigate(page, 'Brick Room')
  await page.getByRole('button', { name: /Capture Bureau/ }).click()
  await page.getByRole('button', { name: 'Reprendre l’envoi' }).click()
  await expect(page.getByText('Vérifier les 1 photos envoyées')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reprendre l’envoi' })).toHaveCount(0)
})

test('camera denial and unavailable worker explain how to continue', async ({ page }) => {
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError') } })
  await setup(page, { workerAvailable: false })
  await page.getByRole('button', { name: 'Ouvrir la caméra' }).click()
  await expect(page.getByRole('alert')).toContainText('Autorisez la caméra')
  await expect(page.getByText('Le traitement 3D est actuellement indisponible.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Construire la vue 3D' })).toBeDisabled()
})

test('room capture opens without downloading a deferred room or 3D module', async ({ page }) => {
  const deferredRequests: string[] = []
  await page.route(/\/assets\/(BrickRooms|RoomViewer)-[^/]+\.js/, async (route) => {
    deferredRequests.push(route.request().url())
    await route.abort('internetdisconnected')
  })
  await setup(page)
  await expect(page.getByRole('button', { name: 'Ouvrir la caméra' })).toBeVisible()
  await expect(page.getByText('Ouverture de Brick Room…')).toHaveCount(0)
  expect(deferredRequests).toEqual([])
})

test('continuous camera scan captures images and stops when paused', async ({ page }) => {
  await setup(page)
  let uploads = 0
  page.on('request', (request) => { if (request.method() === 'PUT' && request.url().includes('/photos/')) uploads++ })
  await page.getByRole('button', { name: 'Ouvrir la caméra' }).click()
  await page.getByRole('button', { name: 'Démarrer le scan continu' }).click()
  await expect.poll(() => uploads, { timeout: 12000 }).toBeGreaterThanOrEqual(2)
  await page.getByRole('button', { name: 'Mettre le scan en pause' }).click()
  await expect(page.getByRole('button', { name: 'Démarrer le scan continu' })).toBeVisible()
  const pausedCount = uploads
  await page.waitForTimeout(2000)
  expect(uploads).toBe(pausedCount)
  await page.getByRole('button', { name: 'Arrêter la caméra' }).click()
  await expect(page.getByRole('button', { name: 'Ouvrir la caméra' })).toBeVisible()
})

test('continuous scan pauses after upload failure and retains the captured image', async ({ page }) => {
  await setup(page, { failUpload: true })
  await page.getByRole('button', { name: 'Ouvrir la caméra' }).click()
  await page.getByRole('button', { name: 'Démarrer le scan continu' }).click()
  await expect(page.getByRole('button', { name: 'Reprendre l’envoi' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Démarrer le scan continu' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mettre le scan en pause' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Reprendre l’envoi' }).click()
  await expect(page.getByText('Vérifier les 1 photos envoyées')).toBeVisible()
})

test('legacy sparse reconstruction can be reopened without losing photos', async ({ page }) => {
  await setup(page, { legacy: true })
  await expect(page.getByText('Cette ancienne reconstruction ne contient que des points de repérage.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ajouter un emplacement' })).toBeDisabled()
  await page.getByRole('button', { name: 'Compléter et reconstruire' }).click()
  await expect(page.getByRole('button', { name: 'Ouvrir la caméra' })).toBeVisible()
  await expect(page.getByText('Vérifier les 21 photos envoyées')).toBeVisible()
})


test('textured reconstruction can be reopened with existing photos', async ({ page }) => {
  await setup(page, { readyMesh: true })
  await page.getByRole('button', { name: 'Compléter et reconstruire' }).click()
  await expect(page.getByText('Vérifier les 21 photos envoyées')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Construire la vue 3D' })).toBeEnabled()
})
