import { useCallback, useEffect, useRef, useState } from 'react'
import { collectionApi } from '../api'
import { COLLECTION_CHANGED } from '../collectionEvents'
import { emptyCollectionFilters } from '../collectionFilters'
import type { CollectionFilters, LegoSet, LegoSetPage } from '../types'

const PAGE_SIZE = 9
const emptyPage: LegoSetPage = { items: [], hasMore: false, nextCursor: null }
function needsImageRepair(item: LegoSet) {
  const cada = /^C\d{4,6}W?$/i.test(item.setNumber)
  return !item.imageUrl || (cada && !(item.imageUrl.startsWith('/media/atypibrick/sets/') && item.imageUrl.includes('?v=')))
}
export function useSetsCollection(account: string, query: string, filters: CollectionFilters) {
  const [page, setPage] = useState<LegoSetPage>(emptyPage)
  const [latestSet, setLatestSet] = useState<LegoSet | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [latestLoading, setLatestLoading] = useState(true)
  const [error, setError] = useState('')
  const [latestError, setLatestError] = useState('')
  const [revision, setRevision] = useState(0)
  const generation = useRef(0)
  const previousRevision = useRef(-1)
  const moreRequest = useRef<AbortController | null>(null)
  const reload = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => { window.addEventListener(COLLECTION_CHANGED, reload); return () => window.removeEventListener(COLLECTION_CHANGED, reload) }, [reload])
  const repair = useCallback(async (items: LegoSet[], current: number) => {
    const missing = items.filter(needsImageRepair)
    for (let start = 0; start < missing.length && current === generation.current; start += 3) {
      const results = await Promise.all(missing.slice(start, start + 3).map((item) => collectionApi.repairImage(item.id).catch(() => item)))
      if (current !== generation.current) return
      const replacements = new Map(results.map((item) => [item.id, item]))
      setPage((previous) => ({ ...previous, items: previous.items.map((item) => replacements.get(item.id) || item) }))
      setLatestSet((previous) => previous ? replacements.get(previous.id) || previous : previous)
    }
  }, [])
  useEffect(() => {
    const current = ++generation.current
    const controller = new AbortController()
    moreRequest.current?.abort(); moreRequest.current = null
    setLoading(true); setLoadingMore(false); setError('')
    const mutation = previousRevision.current >= 0 && previousRevision.current !== revision
    previousRevision.current = revision
    const timer = window.setTimeout(() => {
      void collectionApi.list(query.trim(), null, PAGE_SIZE, filters, controller.signal).then((result) => {
        if (current !== generation.current) return
        setPage(result); void repair(result.items, current)
      }).catch((reason) => { if (!controller.signal.aborted && current === generation.current) setError(reason instanceof Error ? reason.message : 'Impossible de charger la collection') }).finally(() => { if (!controller.signal.aborted && current === generation.current) setLoading(false) })
    }, mutation ? 0 : 350)
    return () => { window.clearTimeout(timer); controller.abort(); moreRequest.current?.abort(); generation.current++ }
  }, [account, query, filters, revision, repair])
  useEffect(() => {
    const controller = new AbortController()
    setLatestLoading(true); setLatestError('')
    // The most recent global addition must not depend on a list filter or sort.
    void collectionApi.list('', null, 1, emptyCollectionFilters, controller.signal).then((result) => { if (!controller.signal.aborted) setLatestSet(result.items[0] || null) }).catch((reason) => { if (!controller.signal.aborted) setLatestError(reason instanceof Error ? reason.message : 'Dernier ajout indisponible') }).finally(() => { if (!controller.signal.aborted) setLatestLoading(false) })
    return () => controller.abort()
  }, [account, revision])
  const loadMore = useCallback(async () => {
    if (!page.hasMore || !page.nextCursor || moreRequest.current) return
    const controller = new AbortController()
    moreRequest.current = controller
    const current = generation.current
    setLoadingMore(true)
    try {
      const result = await collectionApi.list(query.trim(), page.nextCursor, PAGE_SIZE, filters, controller.signal)
      if (!controller.signal.aborted && current === generation.current) { setPage((previous) => ({ ...result, items: [...previous.items, ...result.items.filter((item) => !previous.items.some((existing) => existing.id === item.id))] })); void repair(result.items, current) }
    } catch (reason) { if (!controller.signal.aborted && current === generation.current) setError(reason instanceof Error ? reason.message : 'Impossible de charger la suite') }
    finally { if (moreRequest.current === controller) { moreRequest.current = null; setLoadingMore(false) } }
  }, [page.hasMore, page.nextCursor, query, filters, repair])
  return { sets: page.items, hasMore: page.hasMore, latestSet, loading, loadingMore, latestLoading, error, latestError, reload, loadMore }
}
