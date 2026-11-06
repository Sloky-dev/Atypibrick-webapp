import type { CollectionFilters } from './types'

export const emptyCollectionFilters: CollectionFilters = {
  incomplete: '', brand: '', theme: '', condition: '', gift: '', purchaseDateFrom: '', purchaseDateTo: '',
  priceMin: '', priceMax: '', partsMin: '', partsMax: '', sort: 'newest',
}
const brands = ['LEGO', 'CaDA', 'Jie Star', 'Lumibricks', 'MEGA', 'Mattel Brick Shop']
const sorts = ['newest', 'oldest', 'purchase_date_asc', 'purchase_date_desc', 'price_asc', 'price_desc', 'parts_asc', 'parts_desc']
export function readSetSelection(params: URLSearchParams) {
  const filters = { ...emptyCollectionFilters }
  const brand = params.get('brand') || ''
  if (brands.includes(brand)) filters.brand = brand as CollectionFilters['brand']
  filters.theme = (params.get('theme') || '').slice(0, 120)
  const condition = params.get('condition') || ''
  if (['Neuf', 'Occasion'].includes(condition)) filters.condition = condition
  if (params.get('incomplete') === 'true') filters.incomplete = 'true'
  const gift = params.get('gift') || ''
  if (['true', 'false', 'gwp'].includes(gift)) filters.gift = gift as CollectionFilters['gift']
  const sort = params.get('sort') || ''
  if (sorts.includes(sort)) filters.sort = sort as CollectionFilters['sort']
  for (const key of ['priceMin', 'priceMax', 'partsMin', 'partsMax'] as const) {
    const value = (params.get(key) || '').trim()
    const valid = key.startsWith('parts') ? /^\d+$/.test(value) && Number(value) <= 2147483647 : /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)
    if (value.length <= 24 && valid && Number.isFinite(Number(value))) filters[key] = value
  }
  for (const key of ['purchaseDateFrom', 'purchaseDateTo'] as const) {
    const value = params.get(key) || ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value) filters[key] = value
  }
  return { query: (params.get('q') || '').slice(0, 120), filters }
}
export function writeSetSelection(query: string, filters: CollectionFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  for (const [key, value] of Object.entries(filters)) if (value && (key !== 'sort' || value !== 'newest')) params.set(key, value)
  return params
}
