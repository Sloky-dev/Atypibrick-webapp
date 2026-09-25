import { test, expect } from '@playwright/test'

test('collection remains usable and retired room data is cleared', async ({ page }) => {
  const errors: string[] = []
  const requests: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => requests.push(request.url()))
  await page.route('**/api/atypibrick/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/atypibrick/v1', '')
    const json = (value: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(value) })
    if (path === '/auth/me') return json({ email: 'test@example.org' })
    if (path === '/collection/summary') return json({ itemCount: 1, setCount: 1, totalParts: 7541, totalInvested: '500', brands: [], themes: [], conditions: [], purchaseYears: [] })
    if (path === '/collection') return json({ items: [{ id: 'set-1', name: 'Millennium Falcon', setNumber: '75192', brand: 'LEGO', theme: 'Star Wars', imageUrl: '/media/atypibrick/sets/test.jpg?v=1', numParts: 7541, purchasePrice: '500', totalInvested: '500', replacementCost: '0', condition: 'Neuf', missingPartsCount: 0, notes: '', isGift: false, isSealed: false }], hasMore: false, nextCursor: null })
    return route.fulfill({ status: 404, body: '{}' })
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Millennium Falcon', exact: true })).toBeVisible()
  await page.evaluate(async () => {
    localStorage.setItem('retirement-test', 'keep')
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('atypibrick-room-captures', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('captures')
      request.onsuccess = () => { request.result.close(); resolve() }
      request.onerror = () => reject(request.error)
    })
  })
  await page.reload()
  await expect(page.locator('.set-card').getByRole('button', { name: 'Modifier', exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(async () => (await indexedDB.databases()).some((db) => db.name === 'atypibrick-room-captures'))).toBe(false)
  expect(await page.evaluate(() => localStorage.getItem('retirement-test'))).toBe('keep')
  await expect(page.getByText('Brick Room', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Localiser/ })).toHaveCount(0)
  expect(requests.some((url) => /\/rooms(?:\/|$)/.test(url))).toBe(false)
  await page.locator('.set-card').getByRole('button', { name: 'Modifier', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeVisible()
  expect(errors).toEqual([])
})


test('statistics filter by raw brand and theme and can be cleared', async ({ page }) => {
  const items = [
    { id: '1', name: 'Falcon', brand: 'LEGO', theme: 'Star Wars' },
    { id: '2', name: 'Dinosaur', brand: 'Jie Star', theme: 'Dinosaures' },
  ].map((item) => ({ ...item, setNumber: '12345', imageUrl: '/test.jpg', totalInvested: '10', condition: 'Neuf', missingPartsCount: item.id === '1' ? 3 : 0 }))
  const brands = ['LEGO', 'Jie Star', 'CaDA', 'Lumibricks', 'MEGA', 'Mattel Brick Shop'].map((label) => ({ label, count: 1 }))
  await page.route('**/api/atypibrick/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const json = (value: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(value) })
    if (url.pathname.endsWith('/auth/me')) return json({ email: 'test@example.org' })
    if (url.pathname.endsWith('/collection/summary')) return json({ itemCount: 2, setCount: 2, totalParts: 100, totalInvested: '20', brands, themes: [{ label: 'Star Wars', brands: ['LEGO'], count: 1 }], conditions: [], purchaseYears: [] })
    if (url.pathname.endsWith('/missing-parts')) return json([])
    if (url.pathname.endsWith('/collection')) return json({ items: items.filter((item) => (!url.searchParams.get('incomplete') || item.missingPartsCount > 0) && (!url.searchParams.get('brand') || item.brand === url.searchParams.get('brand')) && (!url.searchParams.get('theme') || item.theme === url.searchParams.get('theme'))), hasMore: false, nextCursor: null })
    return route.fulfill({ status: 404, body: '{}' })
  })
  await page.goto('/')
  await expect(page.locator('.set-card')).toHaveCount(2)
  await page.getByRole('button', { name: 'Sets incomplets', exact: true }).click()
  await expect(page.locator('.set-card')).toHaveCount(1)
  await page.getByRole('button', { name: '3 pièces manquantes', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Pièces manquantes', exact: true })).toBeVisible()
  await page.getByLabel('Fermer', { exact: true }).click()
  await page.getByRole('button', { name: 'Effacer les filtres', exact: true }).click()
  await expect(page.locator('.set-card')).toHaveCount(2)
  await page.getByRole('button', { name: 'Filtrer : LEGO', exact: true }).click()
  await expect(page.locator('.set-card')).toHaveCount(1)
  await expect(page.locator('.set-card')).toContainText('Falcon')
  await page.getByRole('button', { name: 'Effacer les filtres', exact: true }).click()
  await expect(page.locator('.set-card')).toHaveCount(2)
  await page.getByRole('button', { name: 'Filtrer : Jie Star', exact: true }).click()
  await expect(page.locator('.set-card')).toHaveCount(1)
  await expect(page.locator('.set-card')).toContainText('Dinosaur')
  await page.getByRole('button', { name: 'Filtrer : Star Wars (LEGO)', exact: true }).click()
  await expect(page.locator('.set-card')).toHaveCount(1)
  await expect(page.locator('.set-card')).toContainText('Falcon')
  await page.getByRole('button', { name: 'Afficher les autres catégories' }).click()
  await page.getByRole('button', { name: 'Filtrer : MEGA', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Aucun set ne correspond' })).toBeVisible()
  await page.getByRole('button', { name: 'Effacer les filtres', exact: true }).click()
  await expect(page.locator('.set-card')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Effacer les filtres', exact: true })).toHaveCount(0)
})


test('save feedback and deletion undo handle failures without losing data', async ({ page }) => {
  let deleted = false
  let failSave = true
  let failRestore = true
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const item = { id: 'set-1', name: 'Falcon', setNumber: '75192', brand: 'LEGO', theme: 'Star Wars', imageUrl: '/test.jpg', numParts: 100, purchasePrice: '50', totalInvested: '50', condition: 'Neuf', notes: '', missingPartsCount: 0, isGift: false, isSealed: false }
  await page.route('**/api/atypibrick/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const json = (value: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
    if (path.endsWith('/auth/me')) return json({ email: 'test@example.org' })
    if (path.endsWith('/collection/summary')) return json({ itemCount: deleted ? 0 : 1, setCount: 1, totalParts: 100, totalInvested: '50', brands: [], themes: [], conditions: [], purchaseYears: [] })
    if (path.endsWith('/collection/set-1') && route.request().method() === 'PUT') {
      if (failSave) return json({ detail: [{ loc: ['body', 'purchasePrice'], msg: 'invalid' }] }, 422)
      return json(item)
    }
    if (path.endsWith('/collection/set-1') && route.request().method() === 'DELETE') { deleted = true; return route.fulfill({ status: 204 }) }
    if (path.endsWith('/trash/set-1/restore')) {
      if (failRestore) return route.fulfill({ status: 503, body: 'Internal error' })
      deleted = false; return route.fulfill({ status: 204 })
    }
    if (path.endsWith('/collection')) return json({ items: deleted ? [] : [item], hasMore: false, nextCursor: null })
    return json({}, 404)
  })
  await page.goto('/')
  await page.locator('.set-card').getByRole('button', { name: 'Modifier', exact: true }).click()
  await page.getByLabel('Notes').fill('Texte conservé')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Certaines informations sont invalides')
  await expect(page.getByLabel('Notes')).toHaveValue('Texte conservé')
  failSave = false
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Modifications enregistrées')
  await page.locator('.set-card').getByRole('button', { name: 'Supprimer', exact: true }).click()
  await expect(page.locator('.set-card')).toHaveCount(0)
  await page.getByRole('button', { name: 'Annuler la suppression', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Le serveur rencontre un problème')
  failRestore = false
  await page.getByRole('button', { name: 'Annuler la suppression', exact: true }).click()
  await expect(page.locator('.set-card')).toHaveCount(1)
  await expect(page.getByText('Suppression annulée. Le set a été restauré.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Annuler la suppression', exact: true })).toHaveCount(0)
  await expect(page.getByText('Suppression annulée. Le set a été restauré.', { exact: true })).toHaveCount(0, { timeout: 7000 })
  await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 7000 })
  expect(errors).toEqual([])
})
