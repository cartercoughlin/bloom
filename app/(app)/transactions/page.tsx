'use client'

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { TransactionsTable } from "@/components/transactions-table"
import type { Transaction, Category } from "@/lib/transaction-display"
import { SyncButton } from "@/components/sync-button"
import { Skeleton } from "@/components/ui/skeleton"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { useAppData, CACHE_KEYS } from "@/contexts/app-data-context"
import { useCachedData } from "@/hooks/use-cached-data"

interface TransactionsPageData {
  transactions: Transaction[]
  categories: Category[]
}

export default function TransactionsPage() {
  const router = useRouter()
  const appData = useAppData()

  const fetchTransactions = useCallback(async (): Promise<TransactionsPageData | null> => {
    const supabase = createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      router.push("/auth/login")
      return null
    }

    const [transactionsResult, categoriesResult, accountsResult] = await Promise.all([
      // `*` rather than a column list so plaid_details is included once its
      // migration has run, without breaking the page before then
      supabase
        .from("transactions")
        .select(`
          *,
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
        .order("name"),

      supabase
        .from("account_balances")
        // `*` so custom_name is picked up once its migration has run
        .select("*")
        .eq("user_id", user.id)
        .not("plaid_account_id", "is", null),
    ])

    const accountNames = new Map<string, string>(
      (accountsResult.data || []).map((a: any) => [a.plaid_account_id, a.custom_name || a.account_name])
    )

    return {
      transactions: (transactionsResult.data || []).map((tx: any) => ({
        ...tx,
        account_name: tx.plaid_account_id ? accountNames.get(tx.plaid_account_id) || null : null,
      })) as Transaction[],
      categories: categoriesResult.data || []
    }
  }, [router])

  const { data, loading, refreshing, refresh, mutate } = useCachedData(CACHE_KEYS.transactions, fetchTransactions)

  const handleTransactionsChange = useCallback(
    (updater: (transactions: Transaction[]) => Transaction[]) =>
      mutate(prev => ({ ...prev, transactions: updater(prev.transactions) })),
    [mutate]
  )

  const handleCategoriesChange = useCallback(
    (updater: (categories: Category[]) => Category[]) =>
      mutate(prev => ({ ...prev, categories: updater(prev.categories) })),
    [mutate]
  )

  // Budgets and dashboard refetch the next time they're shown
  const handleBudgetDataChanged = useCallback(
    () => appData.markStale([CACHE_KEYS.budgets, CACHE_KEYS.dashboard]),
    [appData.markStale]
  )

  if (loading && !data) {
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
      <PullToRefresh onRefresh={refresh} />
      <div className="flex items-center justify-between mt-3 mb-2">
        <h1 className="text-lg sm:text-2xl font-bold text-green-600 flex items-center gap-2">
          Transactions
          {refreshing && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </h1>
        <SyncButton />
      </div>
      <TransactionsTable
        transactions={data?.transactions || []}
        categories={data?.categories || []}
        onTransactionsChange={handleTransactionsChange}
        onCategoriesChange={handleCategoriesChange}
        onBudgetDataChanged={handleBudgetDataChanged}
      />
    </div>
  )
}
