'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { TransactionsTable } from "@/components/transactions-table"
import { SyncButton } from "@/components/sync-button"
import { cache } from "@/lib/capacitor"
import { Skeleton } from "@/components/ui/skeleton"

export default function TransactionsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])

  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient()

        // Check authentication
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          router.push("/auth/login")
          return
        }

        // Try to load from cache first
        const cachedData = await cache.getJSON<any>('transactions-page')
        if (cachedData) {
          setTransactions(cachedData.transactions || [])
          setCategories(cachedData.categories || [])
          setLoading(false)
        }

        // Fetch fresh data
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

        // Update state
        setTransactions(newData.transactions)
        setCategories(newData.categories)
        setLoading(false)

        // Cache the data
        await cache.setJSON('transactions-page', newData)
      } catch (error) {
        console.error("[v0] Error loading transactions:", error)
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  if (loading && transactions.length === 0) {
    return (
      <div className="px-2 sm:px-6 max-w-full pb-20 sm:pb-6">
        <div className="flex items-center justify-between mt-3 mb-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="px-2 sm:px-6 max-w-full pb-20 sm:pb-6">
      <div className="flex items-center justify-between mt-3 mb-2">
        <h1 className="text-lg font-semibold text-green-600">Transactions</h1>
        <SyncButton />
      </div>

      <TransactionsTable
        transactions={transactions}
        categories={categories}
      />
    </div>
  )
}
