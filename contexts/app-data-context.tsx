"use client"

import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from "react"

// In-memory data cache that persists across page navigations.
// Pages render cached data immediately and refresh in the background
// (see hooks/use-cached-data.ts). Mutations call markStale() so the
// affected pages refetch the next time they render, and mounted pages
// refetch right away because `version` changes.

interface CachedEntry {
  data: any
  fetchedAt: number
}

// Cache key prefixes for the pages that show transaction-derived numbers.
export const CACHE_KEYS = {
  dashboard: "dashboard-",
  budgets: "budgets-",
  transactions: "transactions-page",
  netWorth: "net-worth-",
} as const

interface AppDataContextType {
  get: (key: string) => any | null
  set: (key: string, data: any) => void
  isStale: (key: string, maxAgeMs?: number) => boolean
  // Keep cached data for instant display but force a refetch.
  // With no prefixes, every entry is marked stale.
  markStale: (prefixes?: string[]) => void
  // Bumps whenever data is marked stale, so mounted pages can refetch.
  version: number
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined)

const DEFAULT_MAX_AGE = 5 * 60 * 1000 // 5 minutes
// Refetch when the app comes back to the foreground after this long
const RESUME_REFRESH_AFTER = 30 * 1000

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  // Use ref so cache writes don't trigger re-renders of every consumer
  const cacheRef = useRef<Map<string, CachedEntry>>(new Map())
  const [version, setVersion] = useState(0)

  const get = useCallback((key: string): any | null => {
    const entry = cacheRef.current.get(key)
    return entry ? entry.data : null
  }, [])

  const set = useCallback((key: string, data: any) => {
    cacheRef.current.set(key, { data, fetchedAt: Date.now() })
  }, [])

  const isStale = useCallback((key: string, maxAgeMs: number = DEFAULT_MAX_AGE): boolean => {
    const entry = cacheRef.current.get(key)
    if (!entry) return true
    return Date.now() - entry.fetchedAt > maxAgeMs
  }, [])

  const markStale = useCallback((prefixes?: string[]) => {
    for (const [key, entry] of cacheRef.current) {
      if (!prefixes || prefixes.some(p => key.startsWith(p))) {
        entry.fetchedAt = 0
      }
    }
    setVersion(v => v + 1)
  }, [])

  // Data can change on the server while the app is backgrounded (cron
  // syncs, edits on another device), so refresh when it comes back.
  useEffect(() => {
    let hiddenAt: number | null = null
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now()
      } else if (hiddenAt !== null && Date.now() - hiddenAt > RESUME_REFRESH_AFTER) {
        hiddenAt = null
        markStale()
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [markStale])

  const value = useMemo(
    () => ({ get, set, isStale, markStale, version }),
    [get, set, isStale, markStale, version]
  )

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  )
}

export function useAppData() {
  const context = useContext(AppDataContext)
  if (!context) {
    throw new Error("useAppData must be used within an AppDataProvider")
  }
  return context
}
