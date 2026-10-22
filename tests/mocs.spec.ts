import { expect, test } from '@playwright/test'

test('MOC creation, PDF download, editing and deletion on desktop and mobile', async ({ page }) => {
  const source = { id: 'base-1', setNumber: '31120', name: 'Château médiéval', brand: 'LEGO' }
  let items: Record<string, unknown>[] = []
  let failSave = true
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/api/atypibrick/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    const json = (value: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
    if (path.endsWith('/auth/me')) return json({ email: 'test@example.org' })
    if (path.endsWith('/collection/summary')) return json({ itemCount: 0, setCount: 0, totalParts: 0, totalInvested: '0', brands: [], themes: [], conditions: [], purchaseYears: [] })
    if (path.endsWith('/collection')) return json({ items: [], hasMore: false, nextCursor: null })
    if (path.endsWith('/mocs/base-sets')) return json([source])
    if (path.endsWith('/notice')) return route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4\n%%EOF', headers: { 'Content-Disposition': 'attachment; filename=notice.pdf' } })
    if (path.endsWith('/mocs/moc-1') && method === 'DELETE') { items = []; return route.fulfill({ status: 204 }) }
    if (/\/mocs(?:\/moc-1)?$/.test(path) && ['POST', 'PUT'].includes(method)) {
      expect(route.request().headers()['content-type']).toContain('multipart/form-data; boundary=')
      const body = route.request().postData() || ''
      expect(body).toContain('"baseSetId":"base-1"')
      expect(body).toContain('"name":"Mon château"')
      if (method === 'POST') { expect(body).toContain('filename="notice.pdf"'); expect(body).toContain('%PDF-1.4') }
      if (failSave) return json({ detail: 'Enregistrement indisponible, réessayez.' }, 422)
      const item = { id: 'moc-1', name: 'Mon château', baseSetId: source.id, baseSetNumber: source.setNumber, baseSetName: source.name, baseSetBrand: source.brand, builtAt: '2026-10-22', notes: method === 'POST' ? 'Ma construction' : 'Modifié', instructionName: 'notice.pdf', createdAt: '2026-10-22T12:00:00Z' }
      items = [item]; return json(item, method === 'POST' ? 201 : 200)
    }
    if (path.endsWith('/mocs')) return json(items)
    return json({})
  })
  await page.goto('/')
  const menu = page.getByRole('button', { name: 'Ouvrir le menu', exact: true })
  if (await menu.isVisible()) await menu.click()
  await page.getByRole('button', { name: 'MOCs', exact: true }).click()
  await expect(page.getByText('Vos briques ont plus d’une histoire')).toBeVisible()
  await page.getByRole('button', { name: 'Ajouter un MOC', exact: true }).click()
  await page.getByLabel('Nom du MOC').fill('Mon château')
  await page.getByLabel('Set de base', { exact: true }).selectOption('base-1')
  await page.getByLabel('Date de construction').fill('2026-10-22')
  await page.getByLabel('Notes', { exact: true }).fill('Ma construction')
  await page.getByLabel('Notice PDF', { exact: false }).setInputFiles({ name: 'notice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') })
  await page.getByRole('button', { name: 'Enregistrer le MOC' }).click()
  await expect(page.getByRole('alert')).toContainText('Enregistrement indisponible')
  await expect(page.getByLabel('Nom du MOC')).toHaveValue('Mon château')
  failSave = false
  await page.getByRole('button', { name: 'Enregistrer le MOC' }).click()
  await expect(page.locator('.moc-card')).toContainText('#31120')
  await expect(page.getByRole('status')).toContainText('MOC ajouté')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Télécharger la notice' }).click()
  expect((await download).suggestedFilename()).toBe('notice.pdf')
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  await expect(page.getByLabel('Set de base', { exact: true })).toHaveValue('base-1')
  await expect(page.getByText('notice.pdf', { exact: true })).toBeVisible()
  await page.getByLabel('Notes', { exact: true }).fill('Modifié')
  await page.getByRole('button', { name: 'Enregistrer le MOC' }).click()
  await expect(page.locator('.moc-card')).toContainText('Modifié')
  await page.getByLabel('Rechercher un MOC', { exact: true }).fill('absent')
  await expect(page.getByText('Aucun MOC trouvé')).toBeVisible()
  await page.getByLabel('Rechercher un MOC', { exact: true }).fill('31120')
  await expect(page.locator('.moc-card')).toHaveCount(1)
  await page.screenshot({ path: `test-results/mocs-${test.info().project.name}.png`, fullPage: true })
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Supprimer Mon château' }).click()
  await expect(page.locator('.moc-card')).toHaveCount(0)
  expect(errors).toEqual([])
})
