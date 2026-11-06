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
  let summaryRequests = 0
  const items = [
    { id: '1', name: 'Falcon', brand: 'LEGO', theme: 'Star Wars' },
    { id: '2', name: 'Dinosaur', brand: 'Jie Star', theme: 'Dinosaures' },
  ].map((item) => ({ ...item, setNumber: '12345', imageUrl: '/test.jpg', totalInvested: '10', condition: 'Neuf', missingPartsCount: item.id === '1' ? 3 : 0 }))
  const brands = ['LEGO', 'Jie Star', 'CaDA', 'Lumibricks', 'MEGA', 'Mattel Brick Shop'].map((label) => ({ label, count: 1 }))
  await page.route('**/api/atypibrick/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const json = (value: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(value) })
    if (url.pathname.endsWith('/auth/me')) return json({ email: 'test@example.org' })
    if (url.pathname.endsWith('/collection/summary')) { summaryRequests++; return json({ itemCount: 2, setCount: 2, totalParts: 100, totalInvested: '25', minifigureInvested: '5', brands, themes: [{ label: 'Star Wars', brands: ['LEGO'], count: 1 }], conditions: [], purchaseYears: [] }) }
    if (url.pathname.endsWith('/minifigures')) return json({ series: [{ id: 's1', name: 'Test', reference: '71048', expectedCount: 2, characters: [{ id: 'c1' }, { id: 'c2' }] }], copies: [2, 3, 100].map((price, index) => ({ id: String(index), seriesId: 's1', characterId: 'c1', purchasePrice: String(price), isGift: index === 2, includedInSet: false, condition: 'Neuf', purchaseDate: null, accessoriesComplete: true, deletedAt: null })) })
    if (url.pathname.endsWith('/missing-parts')) return json([])
    if (url.pathname.endsWith('/collection')) return json({ items: items.filter((item) => (!url.searchParams.get('incomplete') || item.missingPartsCount > 0) && (!url.searchParams.get('brand') || item.brand === url.searchParams.get('brand')) && (!url.searchParams.get('theme') || item.theme === url.searchParams.get('theme'))), hasMore: false, nextCursor: null })
    return route.fulfill({ status: 404, body: '{}' })
  })
  const dashboard = async () => {
    const menu = page.getByRole('button', { name: 'Ouvrir le menu', exact: true })
    if (await menu.isVisible()) await menu.click()
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Stats sets', exact: true })).toBeVisible()
    const miniStats = page.getByRole('region', { name: 'Stats minifigurines', exact: true })
    await expect(miniStats.locator('.mini-summary')).toContainText('5,00')
    await expect(miniStats.locator('.mini-summary strong')).toHaveText(['3', '1', '2', '5,00 €'])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
  await page.goto('/')
  await expect(page.locator('.set-card')).toHaveCount(2)
  await page.getByRole('button', { name: 'Sets incomplets', exact: true }).click()
  await expect(page.locator('.set-card')).toHaveCount(1)
  await page.getByRole('button', { name: '3 pièces manquantes', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Pièces manquantes', exact: true })).toBeVisible()
  await page.getByLabel('Fermer', { exact: true }).click()
  await page.getByRole('button', { name: 'Effacer les filtres', exact: true }).click()
  await expect(page.locator('.set-card')).toHaveCount(2)
  const searched = page.waitForResponse((response) => new URL(response.url()).searchParams.get('q') === 'Falcon')
  await page.getByRole('textbox', { name: 'Rechercher', exact: true }).fill('Falcon')
  await searched
  await dashboard()
  await page.getByRole('button', { name: 'Filtrer : LEGO', exact: true }).click()
  await expect(page.locator('.set-card')).toHaveCount(1)
  await expect(page.locator('.set-card')).toContainText('Falcon')
  await page.getByRole('button', { name: 'Effacer les filtres', exact: true }).click()
  await expect(page.locator('.set-card')).toHaveCount(2)
  await dashboard()
  await page.getByRole('button', { name: 'Filtrer : Jie Star', exact: true }).click()
  await expect(page.locator('.set-card')).toHaveCount(1)
  await expect(page.locator('.set-card')).toContainText('Dinosaur')
  await dashboard()
  await page.getByRole('button', { name: 'Filtrer : Star Wars (LEGO)', exact: true }).click()
  await expect(page.locator('.set-card')).toHaveCount(1)
  await expect(page.locator('.set-card')).toContainText('Falcon')
  await dashboard()
  await page.getByRole('button', { name: 'Afficher les autres catégories' }).click()
  await page.getByRole('button', { name: 'Filtrer : MEGA', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Aucun set ne correspond' })).toBeVisible()
  await page.getByRole('button', { name: 'Effacer les filtres', exact: true }).click()
  await expect(page.locator('.set-card')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Effacer les filtres', exact: true })).toHaveCount(0)
  expect(summaryRequests).toBe(1)
})


test('save feedback and deletion undo handle failures without losing data', async ({ page }) => {
  let summaryRequests = 0
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
    if (path.endsWith('/collection/summary')) { summaryRequests++; return json({ itemCount: deleted ? 0 : 1, setCount: 1, totalParts: 100, totalInvested: '50', brands: [], themes: [], conditions: [], purchaseYears: [] }) }
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
  expect(summaryRequests).toBe(1)
  failSave = false
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Modifications enregistrées')
  await expect.poll(() => summaryRequests).toBe(2)
  await page.locator('.set-card').getByRole('button', { name: 'Supprimer', exact: true }).click()
  await expect(page.locator('.set-card')).toHaveCount(0)
  await expect.poll(() => summaryRequests).toBe(3)
  await page.getByRole('button', { name: 'Annuler la suppression', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Le serveur rencontre un problème')
  expect(summaryRequests).toBe(3)
  failRestore = false
  await page.getByRole('button', { name: 'Annuler la suppression', exact: true }).click()
  await expect(page.locator('.set-card')).toHaveCount(1)
  await expect.poll(() => summaryRequests).toBe(4)
  await expect(page.getByText('Suppression annulée. Le set a été restauré.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Annuler la suppression', exact: true })).toHaveCount(0)
  await expect(page.getByText('Suppression annulée. Le set a été restauré.', { exact: true })).toHaveCount(0, { timeout: 7000 })
  await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 7000 })
  expect(errors).toEqual([])
})


test('set lookup distinguishes unavailable catalogue from unknown reference', async ({ page }) => {
  await page.route('**/api/atypibrick/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: { email: 'test@example.org' } })
    if (url.pathname.endsWith('/collection/summary')) return route.fulfill({ json: { itemCount: 0, setCount: 0, totalParts: 0, totalInvested: '0', brands: [], themes: [], conditions: [], purchaseYears: [] } })
    if (url.pathname.endsWith('/collection')) return route.fulfill({ json: { items: [], hasMore: false, nextCursor: null } })
    if (url.pathname.endsWith('/sets/lookup')) {
      if (url.searchParams.get('setNumber') === '57038') return route.fulfill({ status: 503, json: { detail: { code: 'catalog_unavailable', message: 'Provider unavailable' } } })
      return route.fulfill({ status: 404, json: { detail: 'Aucun set Jie Star trouvé pour la référence 99999' } })
    }
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto('/')
  await page.locator('.hero-actions').getByRole('button', { name: 'Ajouter un set', exact: true }).click()
  const dialog = page.locator('form.modal')
  await page.getByRole('combobox', { name: 'Marque', exact: true }).selectOption('Jie Star')
  await dialog.getByLabel('Numéro du set', { exact: true }).fill('57038')
  await expect(dialog.getByText('Le catalogue de cette marque est temporairement indisponible. Réessayez dans quelques instants.', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Ajouter à ma collection', exact: true })).toBeDisabled()
  await dialog.getByLabel('Numéro du set', { exact: true }).fill('99999')
  await expect(dialog.getByText('Aucun set Jie Star trouvé pour la référence 99999', { exact: true })).toBeVisible()
})
