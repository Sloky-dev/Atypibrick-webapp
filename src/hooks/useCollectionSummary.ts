import { useCallback, useEffect, useState } from 'react'
import { collectionApi } from '../api'
import { COLLECTION_CHANGED } from '../collectionEvents'
import type { CollectionSummary } from '../types'

// App owns this snapshot so switching pages reuses the same per-session statistics.
export function useCollectionSummary(account: string | null) {
  const [snapshot, setSnapshot] = useState<{ account: string | null; data: CollectionSummary | null; error: string }>({ account: null, data: null, error: '' })
  const [retry, setRetry] = useState(0)
  const reload = useCallback(() => setRetry((value) => value + 1), [])
  useEffect(() => {
    if (!account) { setSnapshot({ account: null, data: null, error: '' }); return }
    let active = true
    let generation = 0
    const load = async () => {
      const current = ++generation
      try {
        const data = await collectionApi.summary()
        if (active && current === generation) setSnapshot({ account, data, error: '' })
      } catch (reason) {
        if (active && current === generation) setSnapshot((previous) => ({ account, data: previous.account === account ? previous.data : null, error: reason instanceof Error ? reason.message : 'Chargement des statistiques impossible.' }))
      }
    }
    const changed = () => { void load() }
    window.addEventListener(COLLECTION_CHANGED, changed)
    void load()
    return () => { active = false; window.removeEventListener(COLLECTION_CHANGED, changed) }
  }, [account, retry])
  return { summary: account && snapshot.account === account ? snapshot.data : null, error: account && snapshot.account === account ? snapshot.error : '', reload }
}
