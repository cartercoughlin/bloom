"use client"

import { createContext, useContext, useState, useCallback, useRef } from "react"

// In-memory data cache that persists across page navigations.
// Pages check this context before fetching — if data exists, they
// render immediately and refresh in the background.

interface CachedEntry {
  data: any
  fetchedAt: number
}

interface AppDataContextType {
  get: (key: string) => any | null
  set: (key: string, data: any) => void
  isStale: (key: string, maxAgeMs?: number) => boolean
  invalidate: (pattern?: string) => void
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined)

const DEFAULT_MAX_AGE = 5 * 60 * 1000 // 5 minutes

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  // Use ref so cache updates don't trigger re-renders of every consumer
  const cacheRef = useRef<Map<string, CachedEntry>>(new Map())
  // Counter to force re-render when cache is invalidated
  const [, setVersion] = useState(0)

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

  const invalidate = useCallback((pattern?: string) => {
    if (!pattern) {
      cacheRef.current.clear()
    } else {
      for (const key of cacheRef.current.keys()) {
        if (key.startsWith(pattern)) {
          cacheRef.current.delete(key)
        }
      }
    }
    setVersion(v => v + 1)
  }, [])

  return (
    <AppDataContext.Provider value={{ get, set, isStale, invalidate }}>
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
