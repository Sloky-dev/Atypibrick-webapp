import { test, expect, type Page } from '@playwright/test'

const item = (price = '50') => ({ id: 's1', name: 'Falcon', setNumber: '75192', brand: 'LEGO', theme: 'Star Wars', imageUrl: '/test.jpg', numParts: 100, purchasePrice: price, totalInvested: price, replacementCost: '0', condition: 'Neuf', notes: '', missingPartsCount: 0, isGift: false, isSealed: false })
const summary = (price = '50') => ({ itemCount: 1, setCount: 1, totalParts: 100, totalInvested: price, minifigureInvested: '0', brands: [], themes: [], conditions: [], purchaseYears: [] })
async function menu(page: Page) {
  const button = page.getByRole('button', { name: 'Ouvrir le menu', exact: true })
  if (await button.isVisible()) await button.click()
}

test('statistics can fail and retry without blocking or reloading the set list', async ({ page }) => {
  let summaryRequests = 0
  let listRequests = 0
  let failSummary = true
  await page.route('**/api/atypibrick/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: { email: 'first@example.org' } })
    if (url.pathname.endsWith('/collection/summary')) {
      summaryRequests++
      return failSummary ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: summary() })
    }
    if (url.pathname.endsWith('/collection')) { listRequests++; return route.fulfill({ json: { items: [item()], hasMore: false, nextCursor: null } }) }
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto('/')
  await expect(page.locator('.set-card')).toHaveCount(1)
  await expect(page.getByRole('alert')).toContainText('Impossible d’actualiser les statistiques')
  const searched = page.waitForResponse((response) => new URL(response.url()).searchParams.get('q') === 'Falcon')
  await page.getByRole('textbox', { name: 'Rechercher', exact: true }).fill('Falcon')
  await searched
  await expect(page.locator('.set-card')).toHaveCount(1)
  expect(summaryRequests).toBe(1)
  const listsBeforeRetry = listRequests
  failSummary = false
  await page.getByRole('button', { name: 'Réessayer les statistiques', exact: true }).click()
  await expect(page.locator('.hero-summary')).toContainText('50,00')
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(summaryRequests).toBe(2)
  expect(listRequests).toBe(listsBeforeRetry)
})

test('a slow initial summary cannot overwrite statistics refreshed after saving', async ({ page }) => {
  let price = '50'
  let requests = 0
  let releaseInitial!: () => void
  const gate = new Promise<void>((resolve) => { releaseInitial = resolve })
  await page.route('**/api/atypibrick/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: { email: 'first@example.org' } })
    if (url.pathname.endsWith('/collection/summary')) {
      const snapshot = summary(price)
      if (++requests === 1) await gate
      return route.fulfill({ json: snapshot })
    }
    if (url.pathname.endsWith('/collection/s1')) { price = route.request().postDataJSON().purchasePrice; return route.fulfill({ json: item(price) }) }
    if (url.pathname.endsWith('/collection')) return route.fulfill({ json: { items: [item(price)], hasMore: false, nextCursor: null } })
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto('/')
  await expect(page.locator('.set-card')).toHaveCount(1)
  await expect.poll(() => requests).toBe(1)
  try {
    await page.locator('.set-card').getByRole('button', { name: 'Modifier', exact: true }).click()
    await page.getByRole('spinbutton', { name: "Prix d'achat (€)", exact: true }).fill('75')
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(page.locator('.hero-summary')).toContainText('75,00')
    expect(requests).toBe(2)
    const initialResponse = page.waitForResponse((response) => response.url().endsWith('/collection/summary'))
    releaseInitial()
    await (await initialResponse).finished()
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await expect(page.locator('.hero-summary')).toContainText('75,00')
  } finally { releaseInitial() }
})

test('switching accounts discards private statistics and ignores a previous account response', async ({ page }) => {
  let account = 'first@example.org'
  let requests = 0
  let releaseInitial!: () => void
  const gate = new Promise<void>((resolve) => { releaseInitial = resolve })
  await page.route('**/api/atypibrick/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/auth/me')) return route.fulfill({ json: { email: account } })
    if (path.endsWith('/auth/logout')) return route.fulfill({ status: 204 })
    if (path.endsWith('/auth/login')) { account = 'second@example.org'; return route.fulfill({ json: { accessToken: 'second-token', tokenType: 'bearer', user: { email: account } } }) }
    if (path.endsWith('/collection/summary')) {
      const snapshot = summary(account.startsWith('first') ? '50' : '90')
      if (++requests === 1) await gate
      return route.fulfill({ json: snapshot })
    }
    if (path.endsWith('/collection')) return route.fulfill({ json: { items: [item()], hasMore: false, nextCursor: null } })
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto('/')
  await expect(page.locator('.set-card')).toHaveCount(1)
  await expect.poll(() => requests).toBe(1)
  try {
    await menu(page)
    await page.getByRole('button', { name: /Mon compte first@example.org/ }).click()
    await page.getByRole('button', { name: 'Déconnexion', exact: true }).click()
    await page.getByLabel('Adresse e-mail').fill('second@example.org')
    await page.getByLabel('Mot de passe', { exact: true }).fill('test-password')
    await page.getByRole('button', { name: 'Accéder à ma collection' }).click()
    await expect(page.locator('.hero-summary')).toContainText('90,00')
    expect(requests).toBe(2)
    const oldResponse = page.waitForResponse((response) => response.url().endsWith('/collection/summary'))
    releaseInitial()
    await (await oldResponse).finished()
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await expect(page.locator('.hero-summary')).toContainText('90,00')
  } finally { releaseInitial() }
})
