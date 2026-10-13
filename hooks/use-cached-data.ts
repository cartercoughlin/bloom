"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { cache } from "@/lib/capacitor"
import { useAppData } from "@/contexts/app-data-context"

/**
 * Stale-while-revalidate loader backed by the in-memory AppData cache
 * and the on-disk Capacitor cache.
 *
 * - Shows memory-cached data instantly, falling back to disk on cold start.
 * - Refetches when the entry is stale or another screen marked it stale.
 * - Only the most recent request may write state, so switching months
 *   quickly never shows (or caches) the wrong month.
 *
 * `fetcher` returns null to abort without touching state (e.g. when
 * redirecting to login).
 */
export function useCachedData<T>(key: string, fetcher: () => Promise<T | null>) {
  const appData = useAppData()
  const [data, setData] = useState<T | null>(() => appData.get(key))
  const [loading, setLoading] = useState(data === null)
  const [refreshing, setRefreshing] = useState(false)

  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const keyRef = useRef(key)
  keyRef.current = key
  const requestIdRef = useRef(0)
  // Key whose network data is currently displayed; disk data must not overwrite it
  const freshKeyRef = useRef<string | null>(null)
  // Local edits made while a request is in flight, replayed onto its response
  const pendingEditsRef = useRef<Array<(prev: T) => T>>([])
  const inFlightRef = useRef(false)

  const refresh = useCallback(async () => {
    const requestKey = keyRef.current
    const requestId = ++requestIdRef.current
    pendingEditsRef.current = []
    inFlightRef.current = true
    setRefreshing(true)
    try {
      let fresh: T | null = await fetcherRef.current()
      if (requestId !== requestIdRef.current || fresh === null) return
      for (const edit of pendingEditsRef.current) fresh = edit(fresh)
      pendingEditsRef.current = []
      appData.set(requestKey, fresh)
      freshKeyRef.current = requestKey
      setData(fresh)
      cache.setJSON(requestKey, fresh).catch(() => {})
    } catch (error) {
      console.error(`[useCachedData] Failed to load ${requestKey}:`, error)
    } finally {
      if (requestId === requestIdRef.current) {
        inFlightRef.current = false
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [appData.set])

  useEffect(() => {
    let cancelled = false
    const memCached = appData.get(key)

    if (memCached) {
      setData(memCached)
      setLoading(false)
      if (!appData.isStale(key)) return
    } else {
      // Don't keep showing another month's numbers under this month's label
      freshKeyRef.current = null
      setData(null)
      setLoading(true)
      cache.getJSON<T>(key).then((diskCached) => {
        if (cancelled || !diskCached || freshKeyRef.current === key) return
        setData(diskCached)
        setLoading(false)
      }).catch(() => {})
    }

    refresh()
    return () => { cancelled = true }
    // appData.version: refetch when any screen marks data stale
  }, [key, appData.version, refresh])

  // Local edits (e.g. a recategorized transaction) applied without a refetch
  const mutate = useCallback((updater: (prev: T) => T) => {
    if (inFlightRef.current) pendingEditsRef.current.push(updater)
    setData((prev) => {
      if (prev === null) return prev
      const next = updater(prev)
      appData.set(keyRef.current, next)
      cache.setJSON(keyRef.current, next).catch(() => {})
      return next
    })
  }, [appData.set])

  return { data, loading, refreshing, refresh, mutate }
}
