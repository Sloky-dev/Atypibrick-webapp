import { test, expect, type Page } from '@playwright/test'

const set = { id: 'set-1', name: 'Millennium Falcon', setNumber: '75192', brand: 'LEGO', theme: 'Star Wars', imageUrl: '/media/atypibrick/sets/test.jpg?v=1', numParts: 7541, purchasePrice: '500', totalInvested: '500', replacementCost: '0', condition: 'Neuf', missingPartsCount: 0, notes: '', isGift: false, isSealed: false }
const panorama = () => Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAKklEQVR4nGN0S2liwAaKdW9gFWdiIBEwjWogArDgCu/eyxpDxQ9Mw0ADAJIrBcZUoQWVAAAAAElFTkSuQmCC', 'base64')

async function setup(page: Page, options: { failUpload?: boolean; workerAvailable?: boolean; legacy?: boolean; readyPanorama?: boolean } = {}) {
  let room: Record<string, unknown> | null = null
  const photos: { id: string; captureId: string }[] = []
  let markers: { id: string; label: string; x: number; y: number; z: number; positioned: boolean; sets: typeof set[] }[] = []
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
    if (path === '/rooms/capabilities') return json({ workerAvailable: options.workerAvailable ?? true, minPhotos: 3, maxPhotos: 36 })
    if (path === '/rooms' && method === 'GET') return json(room ? [room] : [])
    if (path === '/rooms' && method === 'POST') {
      room = { id: 'room-1', name: request.postDataJSON().name, status: 'capture', captureKind: 'panorama', stage: 'Capture', error: null, photoCount: 0, createdAt: new Date().toISOString() }
      if (options.legacy || options.readyPanorama) {
        for (let i = 0; i < 21; i++) photos.push({ id: `photo-${i}`, captureId: `capture-${i}` })
        room = { ...room, status: 'ready', captureKind: options.readyPanorama ? 'panorama' : 'legacy', photoCount: 21,  }
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
    if (path === '/rooms/room-1/assemble') {
      room = { ...room!, status: 'ready', captureKind: 'panorama', stage: 'Visite disponible' }
      return json({ ...room, status: 'queued', stage: 'En attente de traitement' })
    }
    if (path === '/rooms/room-1/reset') { photos.length = 0; markers = markers.map((m) => ({ ...m, positioned: false })); room = { ...room, captureKind: 'panorama', status: 'capture', photoCount: 0 }; return json(room) }
    if (path === '/rooms/room-1/panorama' && method === 'PUT') { room = { ...room, status: 'ready' }; return json(room) }
    if (path === '/rooms/room-1/panorama') return route.fulfill({ contentType: 'image/png', body: panorama() })
    if (path === '/rooms/room-1/markers/marker-1' && method === 'PATCH') { markers[0] = { ...markers[0], ...request.postDataJSON(), positioned: true }; return json(markers[0]) }
    if (path === '/rooms/room-1/markers' && method === 'GET') return json(markers)
    if (path === '/rooms/room-1/markers' && method === 'POST') {
      const marker = { ...request.postDataJSON(), id: 'marker-1', positioned: true, sets: [] }
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

test('capture, panorama display, marker, set association and locate', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (entry) => { if (entry.type() === 'error' && entry.text().includes('THREE.')) errors.push(entry.text()) })
  await setup(page)
  await page.getByRole('button', { name: 'Ouvrir la caméra' }).click()
  await page.getByRole('button', { name: 'Prendre une photo' }).click()
  await expect(page.getByText('Vérifier les 1 photos envoyées')).toBeVisible()
  await page.getByRole('button', { name: 'Prendre une photo' }).click()
  await expect(page.getByText('Vérifier les 2 photos envoyées')).toBeVisible()
  await page.getByRole('button', { name: 'Prendre une photo' }).click()
  await expect(page.getByText('Vérifier les 3 photos envoyées')).toBeVisible()
  await page.getByRole('button', { name: 'Assembler le panorama' }).click()
  await expect(page.getByText('Visite panoramique ·', { exact: false })).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: 'Recentrer' })).toBeVisible()
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
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Actualiser le panorama' }).click()
  await page.getByLabel('Importer une photo 360° déjà assemblée').setInputFiles({ name: 'panorama.png', mimeType: 'image/png', buffer: panorama() })
  await expect(page.getByText('À replacer sur le panorama')).toBeVisible()
  await page.getByRole('button', { name: 'Replacer cet emplacement' }).click()
  await page.locator('.room-viewer canvas').click({ position: { x: bounds!.width / 2, y: bounds!.height / 2 } })
  await page.getByRole('button', { name: 'Enregistrer le repère' }).click()
  await expect(page.getByText('À replacer sur le panorama')).toHaveCount(0)
  await expect(page.locator('.room-assigned')).toContainText('Millennium Falcon')
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
  await expect(page.getByText('L’assemblage est actuellement indisponible.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Assembler le panorama' })).toBeDisabled()
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
  await page.getByRole('button', { name: 'Démarrer la capture continue' }).click()
  await expect.poll(() => uploads, { timeout: 12000 }).toBeGreaterThanOrEqual(2)
  await page.getByRole('button', { name: 'Mettre la capture en pause' }).click()
  await expect(page.getByRole('button', { name: 'Démarrer la capture continue' })).toBeVisible()
  const pausedCount = uploads
  await page.waitForTimeout(2000)
  expect(uploads).toBe(pausedCount)
  await page.getByRole('button', { name: 'Arrêter la caméra' }).click()
  await expect(page.getByRole('button', { name: 'Ouvrir la caméra' })).toBeVisible()
})

test('continuous scan pauses after upload failure and retains the captured image', async ({ page }) => {
  await setup(page, { failUpload: true })
  await page.getByRole('button', { name: 'Ouvrir la caméra' }).click()
  await page.getByRole('button', { name: 'Démarrer la capture continue' }).click()
  await expect(page.getByRole('button', { name: 'Reprendre l’envoi' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Démarrer la capture continue' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mettre la capture en pause' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Reprendre l’envoi' }).click()
  await expect(page.getByText('Vérifier les 1 photos envoyées')).toBeVisible()
})

test('legacy capture resets before panorama capture', async ({ page }) => {
  await setup(page, { legacy: true })
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Créer le panorama de cette pièce' }).click()
  await expect(page.getByRole('button', { name: 'Ouvrir la caméra' })).toBeVisible()
  await expect(page.getByText('Vérifier les 21 photos envoyées')).toHaveCount(0)
})

test('import works without stitching worker and panorama can be replaced', async ({ page }) => {
  await setup(page, { workerAvailable: false })
  await page.getByLabel('Importer une photo 360° déjà assemblée').setInputFiles({ name: 'panorama.png', mimeType: 'image/png', buffer: panorama() })
  await expect(page.getByRole('button', { name: 'Recentrer' })).toBeVisible()
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Actualiser le panorama' }).click()
  await expect(page.getByRole('button', { name: 'Ouvrir la caméra' })).toBeVisible()
})
