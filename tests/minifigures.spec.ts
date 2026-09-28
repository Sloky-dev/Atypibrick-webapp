import { test, expect } from '@playwright/test'
import type { MiniCopy, MiniSeries } from '../src/minifigures'

test('collect characters, duplicates, sealed boxes and restore an individual copy', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  let series: MiniSeries[] = []
  let copies: MiniCopy[] = []
  let sequence = 0
  let failSave = false
  let setInTrash = true
  const catalog = { name: 'Série Shrek', brand: 'LEGO', reference: '71053', theme: 'Shrek', expectedCount: 12, characters: ['Shrek', 'Fiona et l’Âne', 'Pinocchio', '’Tit Biscuit', 'La Dragonne', 'Le Chat Potté', 'Thelonious', 'Le Grand Méchant Loup', 'Merlin', 'Lord Farquaad', 'Marraine la Bonne Fée', 'Prince Charmant'].map((name) => ({ name, catalogReference: null })) }
  await page.route('**/api/atypibrick/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/atypibrick/v1', '')
    const method = route.request().method()
    const json = (value: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
    if (path === '/trash') return json(setInTrash ? [{ id: 'deleted-set', name: 'Set supprimé', setNumber: '123', imageUrl: null, deletedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString() }] : [])
    if (path === '/trash/deleted-set/restore') { setInTrash = false; return route.fulfill({ status: 204 }) }
    if (path === '/auth/me') return json({ email: 'test@example.org' })
    if (path === '/collection') return json({ items: [], nextCursor: null, hasMore: false })
    if (path === '/collection/summary') return json({ itemCount: 0, setCount: 0, totalParts: 0, totalInvested: '0', brands: [], themes: [], conditions: [], purchaseYears: [] })
    if (path === '/minifigures/catalog') return json([catalog])
    if (path === '/minifigures') return json({ series, copies: copies.filter((copy) => !copy.deletedAt) })
    if (path.endsWith('/images')) {
      const match = series.find((item) => item.id === path.split('/')[3])!
      match.characters = match.characters.map((character, index) => ({ ...character, catalogReference: `colshr-${index + 1}`, imageUrl: `/media/atypibrick/minifigures/colshr-${index + 1}.webp?v=1` }))
      return json(match)
    }
    if (path === '/minifigures/series') { const payload = route.request().postDataJSON(); const id = `s${++sequence}`; const created = { ...payload, id, characters: payload.characters.map((character: object, i: number) => ({ ...character, id: `${id}-c${i}`, seriesId: id })) }; series.push(created); return json(created) }
    if (path.endsWith('/characters')) { const id = path.split('/')[3]; const character = { ...route.request().postDataJSON(), id: `c${++sequence}`, seriesId: id }; series.find((item) => item.id === id)!.characters.push(character); return json(character) }
    if (path === '/minifigures/copies') {
      if (failSave) return json({ detail: 'Temporary server error' }, 503)
      const copy = { ...route.request().postDataJSON(), id: `copy${++sequence}`, createdAt: new Date().toISOString(), deletedAt: null }; copies.push(copy); return json(copy, 201)
    }
    if (path === '/minifigures/trash') return json(copies.filter((copy) => copy.deletedAt))
    if (path.endsWith('/restore')) { const copy = copies.find((item) => item.id === path.split('/')[3])!; copy.deletedAt = null; return json(copy) }
    if (path.startsWith('/minifigures/copies/')) {
      const copy = copies.find((item) => item.id === path.split('/')[3])!
      if (method === 'DELETE') { copy.deletedAt = new Date().toISOString(); return route.fulfill({ status: 204 }) }
      Object.assign(copy, route.request().postDataJSON()); return json(copy)
    }
    return json({}, 404)
  })
  await page.goto('/')
  const mobileMenu = page.getByRole('button', { name: 'Ouvrir le menu', exact: true })
  if (await mobileMenu.isVisible()) await mobileMenu.click()
  await page.getByRole('button', { name: 'Minifigurines', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Minifigurines', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Ajouter une série', exact: true }).click()
  await page.getByLabel('Rechercher une série du catalogue').fill('71053')
  await page.getByRole('button', { name: 'Série Shrek · 71053 · 12 personnages', exact: true }).click()
  await expect(page.getByText('0/12 personnages · 0 exemplaires')).toBeVisible()
  const shrek = page.locator('.mini-character').filter({ has: page.getByText('Shrek', { exact: true }) })
  await expect(shrek.locator('img')).toHaveAttribute('src', /\/media\/atypibrick\/minifigures\//)
  await shrek.click()
  await page.getByLabel('Prix d’achat (€)').fill('3.99')
  failSave = true
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Le serveur rencontre un problème')
  await expect(page.getByLabel('Prix d’achat (€)')).toHaveValue('3.99')
  failSave = false
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.getByText('1/12 personnages · 1 exemplaires')).toBeVisible()
  await shrek.click()
  await page.getByLabel('Prix d’achat (€)').fill('5.00')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(shrek).toContainText('Possédée ×2')
  await page.getByRole('button', { name: 'Ajouter une boîte scellée', exact: true }).click()
  await page.getByLabel('Prix d’achat (€)').fill('4.00')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.getByText('1/12 personnages · 3 exemplaires')).toBeVisible()
  await page.getByRole('button', { name: 'Mes figurines', exact: true }).click()
  const unknown = page.locator('.mini-owned-card').filter({ hasText: 'Personnage inconnu' })
  await unknown.locator('summary').click()
  await unknown.getByRole('button', { name: /^Modifier / }).click()
  await expect(page.getByLabel('Prix d’achat (€)')).toHaveValue('4.00')
  await page.getByRole('combobox', { name: 'Personnage', exact: true }).selectOption({ label: 'Pinocchio' })
  await page.getByLabel('Boîte scellée', { exact: true }).uncheck()
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  const pinocchio = page.locator('.mini-owned-card').filter({ hasText: 'Pinocchio' })
  await pinocchio.locator('summary').click()
  await pinocchio.getByRole('button', { name: 'Supprimer Pinocchio', exact: true }).click()
  await expect(pinocchio).toHaveCount(0)
  await page.getByRole('button', { name: 'Annuler la suppression', exact: true }).click()
  await expect(pinocchio).toBeVisible()
  await expect(page.getByRole('button', { name: 'Corbeille figurines', exact: true })).toHaveCount(0)
  await pinocchio.locator('summary').click()
  await pinocchio.getByRole('button', { name: 'Supprimer Pinocchio', exact: true }).click()
  await expect(pinocchio).toHaveCount(0)
  if (await mobileMenu.isVisible()) await mobileMenu.click()
  await page.getByRole('button', { name: 'Corbeille', exact: true }).click()
  const trashDialog = page.getByRole('dialog')
  await expect(trashDialog.locator('.trash-list article')).toHaveCount(2)
  await trashDialog.locator('article').filter({ hasText: 'Pinocchio' }).getByRole('button', { name: 'Restaurer', exact: true }).click()
  await expect(trashDialog.locator('.trash-list article')).toHaveCount(1)
  await trashDialog.locator('article').filter({ hasText: 'Set supprimé' }).getByRole('button', { name: 'Restaurer', exact: true }).click()
  await expect(trashDialog.getByRole('heading', { name: 'La corbeille est vide' })).toBeVisible()
  await trashDialog.getByLabel('Fermer', { exact: true }).click()
  await expect(pinocchio).toBeVisible()
  await page.getByRole('combobox', { name: 'Afficher', exact: true }).selectOption('duplicates')
  await expect(page.locator('.mini-owned-card')).toHaveCount(1)
  await expect(page.locator('.mini-owned-card')).toContainText('Shrek')
  await page.getByRole('button', { name: 'Mes séries', exact: true }).click()
  await expect(page.getByText('2/12 personnages · 3 exemplaires')).toBeVisible()
  await expect(page.getByRole('button', { name: /Ajouter un personnage|Modifier la fiche/ })).toHaveCount(0)
  await page.screenshot({ path: `test-results/minifigures-${test.info().project.name}.png`, fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
