import { test, expect } from '@playwright/test'

test('Pick a Brick is a page with scrolling only for overflowing sets', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const group = (id: string, count: number) => ({ setId: id, setName: `Set ${id}`, setNumber: id, totalQuantity: count,
    parts: Array.from({ length: count }, (_, index) => ({ id: `${id}-${index}`, elementId: `${index + 100}`, designId: '3001', name: `Pièce ${index}`, quantity: 1, imageUrl: null, inStock: true })) })
  await page.route('**/api/atypibrick/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    const data = path.endsWith('/auth/me') ? { email: 'test@example.org' }
      : path.endsWith('/parts') ? [group('1', 1), group('2', 20)]
      : path.endsWith('/collection/summary') ? { itemCount: 0, setCount: 0, totalParts: 0, totalInvested: '0', brands: [], themes: [], conditions: [], purchaseYears: [] }
      : { items: [], nextCursor: null, hasMore: false }
    return route.fulfill({ json: data })
  })
  await page.goto('/')
  const menu = page.getByRole('button', { name: 'Ouvrir le menu', exact: true })
  if (await menu.isVisible()) await menu.click()
  await page.getByRole('button', { name: 'Pick a Brick', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Pick a Brick.', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const short = page.getByRole('region', { name: 'Pièces manquantes de Set 1', exact: true })
  const long = page.getByRole('region', { name: 'Pièces manquantes de Set 2', exact: true })
  await expect(short.locator('.pick-part-card')).toHaveCount(1)
  await expect(long.locator('.pick-part-card')).toHaveCount(20)
  expect(await short.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  expect(await long.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
  await long.evaluate((element) => { element.scrollLeft = element.scrollWidth })
  expect(await long.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Tout exporter', exact: true }).click()
  expect((await download).suggestedFilename()).toBe('atypibrick-pieces-manquantes.csv')
  await page.screenshot({ path: `test-results/pick-a-brick-${test.info().project.name}.png`, fullPage: true })
  expect(errors).toEqual([])
})
