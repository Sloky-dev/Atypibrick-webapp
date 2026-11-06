import { test, expect } from '@playwright/test'

const setSummary = { itemCount: 0, setCount: 0, totalParts: 0, totalInvested: '0', brands: [], themes: [], conditions: [], purchaseYears: [] }
const miniSummary = { copyCount: 55, characterCount: 26, duplicateCount: 29, invested: '55', bySeries: [{ label: 'Hors série', count: 55 }], seriesProgress: [], conditions: [{ label: 'Neuf', count: 55 }], purchaseYears: [{ label: 'Non renseignée', count: 55 }], accessories: [{ label: 'Complets', count: 55 }], latestCopy: null }

test('Dashboard requests aggregate minifigure statistics without downloading the collection', async ({ page }) => {
  const miniRequests: string[] = []
  await page.route('**/api/atypibrick/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (path.endsWith('/auth/me')) return route.fulfill({ json: { email: 'test@example.org' } })
    if (path.endsWith('/collection/summary')) return route.fulfill({ json: setSummary })
    if (path.endsWith('/collection')) return route.fulfill({ json: { items: [], hasMore: false, nextCursor: null } })
    if (path.includes('/minifigures')) {
      miniRequests.push(path)
      if (path.endsWith('/minifigures/summary')) { expect(url.searchParams.has('includeLatest')).toBe(false); return route.fulfill({ json: miniSummary }) }
    }
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto('/')
  const menu = page.getByRole('button', { name: 'Ouvrir le menu', exact: true })
  if (await menu.isVisible()) await menu.click()
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click()
  const region = page.getByRole('region', { name: 'Stats minifigurines', exact: true })
  await expect(region.locator('.mini-summary strong')).toHaveText(['55', '26', '29', '55,00 €'])
  expect(miniRequests).toHaveLength(1)
  expect(miniRequests[0]).toMatch(/\/minifigures\/summary$/)
})

test('owned character cards and their copies load in bounded pages with global counts', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const series = Array.from({ length: 26 }, (_, index) => ({ id: `s${index}`, name: 'Hors série', brand: 'LEGO', reference: null, theme: '', isStandalone: true, expectedCount: null, copyCount: index === 0 ? 30 : 1, ownedCount: 1, unknownCount: 0, characters: [{ id: `c${index}`, seriesId: `s${index}`, name: `Hero ${index + 1}`, catalogReference: null, imageUrl: null, copyCount: index === 0 ? 30 : 1 }] }))
  const groups = series.map((s) => ({ seriesId: s.id, characterId: s.characters[0].id, count: s.copyCount }))
  let copyRequests = 0
  const pageSizes: number[] = []
  await page.route('**/api/atypibrick/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const cursor = Number(url.searchParams.get('cursor') || '0')
    const limit = Number(url.searchParams.get('limit'))
    if (path.endsWith('/auth/me')) return route.fulfill({ json: { email: 'test@example.org' } })
    if (path.endsWith('/collection/summary')) return route.fulfill({ json: setSummary })
    if (path.endsWith('/collection')) return route.fulfill({ json: { items: [], hasMore: false, nextCursor: null } })
    if (path.endsWith('/minifigures/catalog')) return route.fulfill({ json: [] })
    if (path.endsWith('/minifigures/summary')) return route.fulfill({ json: miniSummary })
    if (path.endsWith('/minifigures/series')) return route.fulfill({ json: series })
    if (path.endsWith('/minifigures/owned')) {
      expect(limit).toBe(24)
      const result = groups.filter((group, index) => (!url.searchParams.get('state') || group.count > 1) && (!url.searchParams.get('q') || series[index].characters[0].name.toLowerCase().includes(url.searchParams.get('q')!.toLowerCase())))
      const hasMore = cursor + limit < result.length
      return route.fulfill({ json: { items: result.slice(cursor, cursor + limit), hasMore, nextCursor: hasMore ? String(cursor + limit) : null } })
    }
    if (path.endsWith('/minifigures/copies')) {
      copyRequests++
      expect(limit).toBe(12)
      expect(url.searchParams.get('characterId')).toBe('c0')
      const copies = Array.from({ length: 30 }, (_, index) => ({ id: `copy${index}`, seriesId: 's0', characterId: 'c0', purchasePrice: '1', purchaseDate: null, condition: 'Neuf', sealed: false, accessoriesComplete: true, isGift: false, sourceSetId: null, includedInSet: false, notes: '', createdAt: '2026-11-06T12:00:00Z', deletedAt: null }))
      const items = copies.slice(cursor, cursor + limit)
      pageSizes.push(items.length)
      return route.fulfill({ json: { items, hasMore: cursor + limit < copies.length, nextCursor: cursor + limit < copies.length ? String(cursor + limit) : null } })
    }
    throw new Error(`Unexpected unpaginated request: ${path}`)
  })
  await page.goto('/')
  const menu = page.getByRole('button', { name: 'Ouvrir le menu', exact: true })
  if (await menu.isVisible()) await menu.click()
  await page.getByRole('button', { name: 'Mes Minifigurines', exact: true }).click()
  await expect(page.locator('.mini-hero .mini-summary strong')).toHaveText(['55', '26', '29', '55,00 €'])
  await page.getByRole('tab', { name: 'Mes figurines', exact: true }).click()
  await expect(page.locator('.mini-owned-card')).toHaveCount(24)
  expect(copyRequests).toBe(0)
  const first = page.locator('.mini-owned-card').filter({ has: page.getByRole('heading', { name: 'Hero 1 ×30', exact: true }) })
  await first.locator('summary').click()
  await expect(first.locator('.mini-copy')).toHaveCount(12)
  await first.getByRole('button', { name: 'Charger plus d’exemplaires', exact: true }).click()
  await expect(first.locator('.mini-copy')).toHaveCount(24)
  await first.getByRole('button', { name: 'Charger plus d’exemplaires', exact: true }).click()
  await expect(first.locator('.mini-copy')).toHaveCount(30)
  await expect(first.getByRole('button', { name: 'Charger plus d’exemplaires', exact: true })).toHaveCount(0)
  expect(pageSizes).toEqual([12, 12, 6])
  await page.getByRole('button', { name: 'Charger plus de figurines', exact: true }).click()
  await expect(page.locator('.mini-owned-card')).toHaveCount(26)
  await page.getByRole('combobox', { name: 'Afficher', exact: true }).selectOption('duplicates')
  await expect(page.locator('.mini-owned-card')).toHaveCount(1)
  await expect(page.locator('.mini-owned-card h3')).toContainText('×30')
  await expect(page.locator('.mini-hero .mini-summary strong').first()).toHaveText('55')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
