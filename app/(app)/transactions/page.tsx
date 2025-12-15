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
      <div className="container mx-auto px-3 sm:px-6 max-w-7xl pb-20 sm:pb-6">
        <div className="flex items-center justify-between mb-4 md:mb-8">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-3 sm:px-6 max-w-7xl pb-20 sm:pb-6">
      <div className="flex items-center justify-between mb-4 md:mb-8">
        <div>
          <h1 className="text-xl md:text-3xl font-bold mb-1 md:mb-2 text-green-600">Transactions</h1>
          <p className="text-muted-foreground text-xs md:text-sm">View and manage your transactions</p>
        </div>
        <SyncButton />
      </div>

      <TransactionsTable
        transactions={transactions}
        categories={categories}
      />
    </div>
  )
}
