import { useMemo, type SetStateAction } from 'react'
import { useSearchParams } from 'react-router'
import { emptyCollectionFilters, readSetSelection, writeSetSelection } from '../collectionFilters'
import type { CollectionFilters } from '../types'

export function useSetFilters() {
  const [params, setParams] = useSearchParams()
  const { query, filters } = useMemo(() => readSetSelection(params), [params])
  const setQuery = (value: string) => setParams(writeSetSelection(value, filters), { replace: true })
  const setFilters = (value: SetStateAction<CollectionFilters>) => setParams(writeSetSelection(query, typeof value === 'function' ? value(filters) : value), { replace: true })
  const reset = () => setParams(new URLSearchParams(), { replace: true })
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => key === 'sort' ? value !== emptyCollectionFilters.sort : Boolean(value)).length
  return { query, filters, setQuery, setFilters, reset, activeFilterCount }
}
