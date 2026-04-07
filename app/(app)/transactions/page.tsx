'use client'

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { TransactionsTable } from "@/components/transactions-table"
import { SyncButton } from "@/components/sync-button"
import { cache } from "@/lib/capacitor"
import { Skeleton } from "@/components/ui/skeleton"
import { useAppData } from "@/contexts/app-data-context"

const CACHE_KEY = 'transactions-page'

export default function TransactionsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const appData = useAppData()
  const fetchingRef = useRef(false)

  useEffect(() => {
    async function loadData() {
      // Check in-memory context first (instant, no flicker)
      const cached = appData.get(CACHE_KEY)
      if (cached) {
        setTransactions(cached.transactions || [])
        setCategories(cached.categories || [])
        setLoading(false)
        if (!appData.isStale(CACHE_KEY)) return
      }

      if (fetchingRef.current) return
      fetchingRef.current = true

      try {
        const supabase = createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          router.push("/auth/login")
          return
        }

        // If no in-memory cache, try disk cache
        if (!cached) {
          const diskCached = await cache.getJSON<any>(CACHE_KEY)
          if (diskCached) {
            setTransactions(diskCached.transactions || [])
            setCategories(diskCached.categories || [])
            setLoading(false)
          }
        }

        const [transactionsResult, categoriesResult] = await Promise.all([
          supabase
            .from("transactions")
            .select(`
              id,
              date,
              description,
              amount,
              transaction_type,
              bank,
              category_id,
              user_id,
              hidden,
              recurring,
              merchant_name,
              logo_url,
              website,
              category_detailed,
              categories (
                name,
                color,
                icon
              )
            `)
            .eq("user_id", user.id)
            .or("deleted.is.null,deleted.eq.false")
            .order("date", { ascending: false }),

          supabase
            .from("categories")
            .select("*")
            .eq("user_id", user.id)
            .order("name")
        ])

        const newData = {
          transactions: transactionsResult.data || [],
          categories: categoriesResult.data || []
        }

        setTransactions(newData.transactions)
        setCategories(newData.categories)
        setLoading(false)

        appData.set(CACHE_KEY, newData)
        await cache.setJSON(CACHE_KEY, newData)
      } catch (error) {
        console.error("[Transactions] Error loading data:", error)
        setLoading(false)
      } finally {
        fetchingRef.current = false
      }
    }

    loadData()
  }, [])

  if (loading && transactions.length === 0) {
    return (
      <div className="px-2 sm:px-6 max-w-full pb-20 sm:pb-6">
        <div className="flex items-center justify-between mt-3 mb-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="px-2 sm:px-6 max-w-full pb-20 sm:pb-6">
      <div className="flex items-center justify-between mt-3 mb-2">
        <h1 className="text-lg sm:text-2xl font-bold text-green-600">Transactions</h1>
        <SyncButton />
      </div>
      <TransactionsTable transactions={transactions} categories={categories} />
    </div>
  )
}
