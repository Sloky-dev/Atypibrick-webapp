import { test, expect, type Page } from '@playwright/test'

const baseItems = [
  { id: 's1', name: 'Falcon', brand: 'LEGO', theme: 'Star Wars', setNumber: '75192', purchasePrice: '50', totalInvested: '50', numParts: 100 },
  { id: 's2', name: 'Dinosaur', brand: 'Jie Star', theme: 'Dinosaures', setNumber: '57038', purchasePrice: '8', totalInvested: '8', numParts: 188 },
].map((item) => ({ ...item, imageUrl: '/favicon.svg', missingPartsCount: 0, replacementCost: '0', notes: '', isGift: false, isGwp: false, isSealed: false, condition: 'Neuf', purchaseDate: null }))
async function setup(page: Page, authenticated = true) {
  let signedIn = authenticated
  let items = [...baseItems]
  const collectionRequests: URL[] = []
  await page.route('**/api/atypibrick/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const method = route.request().method()
    if (path.endsWith('/auth/me')) return route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? { email: 'test@example.org' } : {} })
    if (path.endsWith('/auth/refresh')) return route.fulfill({ status: 401, json: {} })
    if (path.endsWith('/auth/login')) { signedIn = true; return route.fulfill({ json: { user: { email: 'test@example.org' }, accessToken: 'test-token', tokenType: 'bearer' } }) }
    if (path.endsWith('/collection/summary')) return route.fulfill({ json: { itemCount: items.length, setCount: items.length, totalParts: 288, totalInvested: '58', brands: [{ label: 'LEGO', count: 1 }, { label: 'Jie Star', count: 1 }], themes: [{ label: 'Star Wars', count: 1, brands: ['LEGO'] }], conditions: [], purchaseYears: [] } })
    if (path.endsWith('/collection/s1') && method === 'DELETE') { items = items.filter((item) => item.id !== 's1'); return route.fulfill({ status: 204 }) }
    if (path.endsWith('/trash/s1/restore')) { items = [...baseItems]; return route.fulfill({ status: 204 }) }
    if (path.endsWith('/collection')) {
      collectionRequests.push(url)
      let result = items.filter((item) => (!url.searchParams.get('brand') || item.brand === url.searchParams.get('brand')) && (!url.searchParams.get('q') || item.name.toLowerCase().includes(url.searchParams.get('q')!.toLowerCase())))
      if (url.searchParams.get('limit') === '1') result = result.slice(0, 1)
      return route.fulfill({ json: { items: result, hasMore: false, nextCursor: null } })
    }
    if (path.endsWith('/minifigures/summary')) return route.fulfill({ json: { copyCount: 0, characterCount: 0, duplicateCount: 0, invested: '0', bySeries: [], seriesProgress: [], conditions: [], purchaseYears: [], accessories: [], latestCopy: null } })
    if (path.endsWith('/minifigures/owned')) return route.fulfill({ json: { items: [], hasMore: false, nextCursor: null } })
    if (['/minifigures/series', '/minifigures/catalog', '/minifigures/trash', '/mocs', '/parts', '/trash'].some((suffix) => path.endsWith(suffix))) return route.fulfill({ json: [] })
    return route.fulfill({ status: 404, json: {} })
  })
  return collectionRequests
}
async function navigate(page: Page, name: string) {
  const menu = page.getByRole('button', { name: 'Ouvrir le menu', exact: true })
  if (await menu.isVisible()) await menu.click()
  await page.getByRole('link', { name, exact: true }).click()
}

test('all pages have reloadable direct links and non-set pages avoid loading the set list', async ({ page }) => {
  const requests = await setup(page)
  for (const [path, title] of [['/dashboard', 'Dashboard'], ['/minifigurines', 'Ma collection MINIFIG.'], ['/mocs', 'MOCs.'], ['/pick-a-brick', 'Pick a Brick.'], ['/corbeille', 'Corbeille']]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  }
  expect(requests).toHaveLength(0)
  await page.goto('/sets')
  await expect(page.getByRole('heading', { name: 'Mes sets BRICK.', exact: true })).toBeVisible()
  await expect(page.locator('.set-card')).toHaveCount(2)
  await page.reload()
  await expect(page.locator('.set-card')).toHaveCount(2)
})

test('set filters survive reload and browser back and forward through their URL', async ({ page }) => {
  await setup(page)
  await page.goto('/sets?brand=Jie+Star&q=Dinosaur&sort=price_desc')
  await expect(page.locator('.set-card')).toHaveCount(1)
  await expect(page.locator('.set-card')).toContainText('Dinosaur')
  await expect(page.getByRole('textbox', { name: 'Rechercher', exact: true })).toHaveValue('Dinosaur')
  // Latest addition remains global, even while the list is filtered.
  await expect(page.locator('.latest-set-info strong')).toHaveText('Falcon')
  await navigate(page, 'Dashboard')
  await expect(page).toHaveURL(/\/dashboard$/)
  await navigate(page, 'Pick a Brick')
  await expect(page).toHaveURL(/\/pick-a-brick$/)
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('textbox', { name: 'Rechercher', exact: true })).toHaveValue('Dinosaur')
  await expect(page.locator('.set-card')).toHaveCount(1)
  expect(new URL(page.url()).searchParams.get('brand')).toBe('Jie Star')
  await page.reload()
  await expect(page.locator('.set-card')).toContainText('Dinosaur')
  await page.goForward()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Filtrer : LEGO', exact: true }).click()
  await expect(page).toHaveURL(/\/sets\?brand=LEGO#collection$/)
  await expect(page.locator('.set-card')).toContainText('Falcon')
})

test('filter edits replace history entries and clearing filters clears the URL atomically', async ({ page }) => {
  await setup(page)
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  await navigate(page, 'Mes sets')
  await expect(page.locator('.set-card')).toHaveCount(2)
  const historyLength = await page.evaluate(() => history.length)
  await page.getByRole('textbox', { name: 'Rechercher', exact: true }).fill('Falcon')
  await expect(page.locator('.set-card')).toHaveCount(1)
  await page.getByRole('button', { name: /^Filtres/ }).click()
  await page.getByRole('combobox', { name: 'Marque', exact: true }).selectOption('LEGO')
  await expect.poll(() => new URL(page.url()).searchParams.get('brand')).toBe('LEGO')
  expect(await page.evaluate(() => history.length)).toBe(historyLength)
  await page.getByRole('button', { name: 'Effacer les filtres', exact: true }).click()
  await expect(page).toHaveURL(/\/sets$/)
  await expect(page.locator('.set-card')).toHaveCount(2)
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
})

test('a private direct link resumes its page after login', async ({ page }) => {
  await setup(page, false)
  await page.goto('/pick-a-brick')
  await expect(page.getByRole('heading', { name: 'Bienvenue.', exact: true })).toBeVisible()
  await page.getByLabel('Adresse e-mail').fill('test@example.org')
  await page.getByLabel('Mot de passe', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Accéder à ma collection' }).click()
  await expect(page.getByRole('heading', { name: 'Pick a Brick.', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/pick-a-brick$/)
})

test('undo remains available after navigating away from the sets page', async ({ page }) => {
  await setup(page)
  await page.goto('/sets')
  await expect(page.locator('.set-card')).toHaveCount(2)
  await page.locator('.set-card').filter({ hasText: 'Falcon' }).getByRole('button', { name: 'Supprimer', exact: true }).click()
  await navigate(page, 'Dashboard')
  await page.getByRole('button', { name: 'Annuler la suppression', exact: true }).click()
  await expect(page.getByText('Suppression annulée. Le set a été restauré.', { exact: true })).toBeVisible()
  await navigate(page, 'Mes sets')
  await expect(page.locator('.set-card')).toHaveCount(2)
})

test('invalid URLs are safe and unknown pages have a working return link', async ({ page }) => {
  const requests = await setup(page)
  await page.goto('/sets?brand=unknown&sort=invalid&partsMin=1e99&purchaseDateFrom=2026-02-31')
  await expect(page.locator('.set-card')).toHaveCount(2)
  for (const request of requests) { expect(request.searchParams.get('brand')).toBeNull(); expect(request.searchParams.get('partsMin')).toBeNull(); expect(request.searchParams.get('purchaseDateFrom')).toBeNull(); expect(request.searchParams.get('sort')).toBe('newest') }
  await page.goto('/not-a-page')
  await expect(page.getByRole('heading', { name: 'Page introuvable', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Revenir à mes sets', exact: true }).click()
  await expect(page.locator('.set-card')).toHaveCount(2)
})
