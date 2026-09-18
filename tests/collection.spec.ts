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
