import { expect, test } from '@playwright/test'

test('GWP price is zero and the gift status persists when editing', async ({ page }) => {
  let item: Record<string, unknown> | null = null
  const saved: Record<string, unknown>[] = []
  await page.route('**/api/atypibrick/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const json = (value: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(value) })
    if (path.endsWith('/auth/me')) return json({ email: 'test@example.org' })
    if (path.endsWith('/sets/lookup')) return json({ setNumber: '40567', name: 'Forest Hideout', theme: 'Castle', numParts: 258, imageUrl: null })
    if (['POST', 'PUT'].includes(route.request().method()) && /\/collection(?:\/set-gwp)?$/.test(path)) {
      const payload = route.request().postDataJSON()
      saved.push(payload)
      item = { ...payload, id: 'set-gwp', name: 'Forest Hideout', theme: 'Castle', numParts: 258, imageUrl: null, missingPartsCount: 0, replacementCost: '0', totalInvested: payload.purchasePrice }
      return json(item)
    }
    if (path.endsWith('/collection/summary')) return json({ itemCount: item ? 1 : 0, setCount: item ? 1 : 0, totalParts: item ? 258 : 0, totalInvested: item?.purchasePrice || '0', brands: [], themes: [], conditions: [], purchaseYears: [] })
    if (path.endsWith('/collection')) return json({ items: item ? [item] : [], hasMore: false, nextCursor: null })
    return json({})
  })
  await page.goto('/')
  await page.locator('.hero-actions').getByRole('button', { name: 'Ajouter un set', exact: true }).click()
  await page.getByLabel('Numéro du set').fill('40567')
  await expect(page.locator('.resolved-set')).toContainText('Forest Hideout')
  const price = page.getByLabel("Prix d'achat (€)", { exact: true })
  const gift = page.getByRole('checkbox', { name: /Gift with purchase/ })
  await price.fill('25')
  await gift.check()
  await expect(price).toHaveValue('0')
  await expect(price).toBeDisabled()
  await page.getByRole('button', { name: 'Ajouter à ma collection', exact: true }).click()
  await expect(page.locator('.set-card')).toHaveCount(1)
  expect(saved[0]).toMatchObject({ isGift: true, purchasePrice: '0' })
  await page.locator('.set-card').getByRole('button', { name: 'Modifier', exact: true }).click()
  await expect(gift).toBeChecked()
  await expect(price).toBeDisabled()
  await gift.uncheck()
  await expect(price).toBeEnabled()
  await price.fill('12.50')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.locator('.modal')).toHaveCount(0)
  expect(saved[1]).toMatchObject({ isGift: false, purchasePrice: '12.50' })
})
