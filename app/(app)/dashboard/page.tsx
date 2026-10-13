'use client'

import { useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { createClient } from "@/lib/supabase/client"
import { CategorySummary } from "@/components/category-summary"
import { BudgetOverview } from "@/components/budget-overview"
import { Skeleton } from "@/components/ui/skeleton"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { useMonth } from "@/contexts/month-context"
import { CACHE_KEYS } from "@/contexts/app-data-context"
import { useCachedData } from "@/hooks/use-cached-data"
import { Loader2 } from "lucide-react"
import { calculateHistoricalRecurring, HistoricalRecurringData } from "@/lib/budget/historical-recurring"
import { computeCategoryTotals } from "@/lib/compute-category-totals"

// Lazy-load the chart component — Recharts is ~200KB and not needed for initial render
const MonthlySpendingComparison = dynamic(
  () => import("@/components/monthly-spending-comparison").then(mod => ({ default: mod.MonthlySpendingComparison })),
  {
    loading: () => (
      <div className="border rounded-lg p-6">
        <Skeleton className="h-6 w-32 mb-2" />
        <Skeleton className="h-4 w-48 mb-4" />
        <Skeleton className="h-48 w-full" />
      </div>
    ),
    ssr: false,
  }
)

interface DashboardData {
  currentMonthTransactions: any[]
  previousMonthTransactions: any[]
  budgets: any[]
  categories: any[]
  rolloverByCategory: Record<string, number>
  historicalRecurring: HistoricalRecurringData
}

const EMPTY_HISTORICAL: HistoricalRecurringData = { byCategory: {}, total: 0, monthsUsed: 0 }
const DASHBOARD_CACHE_VERSION = "v3"
const EMPTY_DATA: DashboardData = {
  currentMonthTransactions: [],
  previousMonthTransactions: [],
  budgets: [],
  categories: [],
  rolloverByCategory: {},
  historicalRecurring: EMPTY_HISTORICAL,
}

export default function DashboardPage() {
  const router = useRouter()
  const { selectedMonth, selectedYear, isCurrentMonth } = useMonth()

  const cacheKey = `${CACHE_KEYS.dashboard}${selectedYear}-${selectedMonth}-${DASHBOARD_CACHE_VERSION}`

  const fetchDashboardData = useCallback(async (): Promise<DashboardData | null> => {
    const supabase = createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      router.push("/auth/login")
      return null
    }

    // Get selected month date range
    const firstDay = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
    const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1
    const nextYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear
    const nextMonthFirstDay = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
    const previousMonth = selectedMonth === 1 ? 12 : selectedMonth - 1
    const previousYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear
    const previousFirstDay = `${previousYear}-${String(previousMonth).padStart(2, '0')}-01`

    // Fetch everything in parallel — including rollover via API route
    const [transactionsResult, previousTransactionsResult, budgetsResult, categoriesResult, rolloverResponse] = await Promise.all([
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
        .gte("date", firstDay)
        .lt("date", nextMonthFirstDay)
        .or("deleted.is.null,deleted.eq.false")
        .order("date", { ascending: false }),

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
        .gte("date", previousFirstDay)
        .lt("date", firstDay)
        .or("deleted.is.null,deleted.eq.false")
        .order("date", { ascending: false }),

      supabase
        .from("budgets")
        .select(`
          id,
          amount,
          category_id,
          month,
          year,
          enable_rollover,
          categories (
            name,
            color,
            icon,
            is_rollover
          )
        `)
        .eq("user_id", user.id)
        .eq("month", selectedMonth)
        .eq("year", selectedYear),

      supabase
        .from("categories")
        .select("*")
        .eq("user_id", user.id)
        .order("name"),

      fetch(`/api/rollover?month=${selectedMonth}&year=${selectedYear}`, { cache: "no-store" }),
    ])

    const rollover = rolloverResponse.ok ? await rolloverResponse.json() : {}

    const regularBudgets = (budgetsResult.data || []).filter(
      (budget: any) => !budget.categories?.is_rollover
    )

    let historicalRecurringData: HistoricalRecurringData = EMPTY_HISTORICAL
    const now = new Date()
    if (selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear()) {
      const budgetCategoryIds = regularBudgets.map((b: any) => b.category_id)
      historicalRecurringData = await calculateHistoricalRecurring(
        supabase,
        user.id,
        selectedMonth,
        selectedYear,
        budgetCategoryIds,
        3
      )
    }

    const newData: DashboardData = {
      currentMonthTransactions: transactionsResult.data || [],
      previousMonthTransactions: previousTransactionsResult.data || [],
      budgets: regularBudgets,
      categories: categoriesResult.data || [],
      rolloverByCategory: rollover,
      historicalRecurring: historicalRecurringData,
    }

    return newData
  }, [router, selectedMonth, selectedYear])

  const { data: cachedData, loading, refreshing, refresh } = useCachedData(cacheKey, fetchDashboardData)
  const data = cachedData || EMPTY_DATA

  // Memoize the category totals computation so it only reruns when transactions change
  const netByCategory = useMemo(
    () => computeCategoryTotals(data.currentMonthTransactions),
    [data.currentMonthTransactions]
  )

  if (loading && !cachedData) {
    return (
      <div className="container mx-auto p-3 md:p-6 max-w-7xl pb-20 md:pb-6">
        <div className="mb-4 md:mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="space-y-4 md:space-y-6">
          <Skeleton className="h-48 w-full" />
          <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-3 md:p-6 max-w-7xl pb-20 md:pb-6">
      <PullToRefresh onRefresh={refresh} />
      <div className="mb-4 md:mb-8">
        <h1 className="text-xl md:text-3xl font-bold mb-1 md:mb-2 text-green-600 flex items-center gap-2">
          Dashboard
          {refreshing && (
            <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Updating
            </span>
          )}
        </h1>
        <p className="text-muted-foreground text-xs md:text-sm">
          {isCurrentMonth() ? 'Your spending insights for this month' : `Review spending for ${new Date(selectedYear, selectedMonth - 1).toLocaleString("default", { month: "long", year: "numeric" })}`}
        </p>
      </div>

      <div className="space-y-4 md:space-y-6">
        <BudgetOverview
          budgets={data.budgets}
          netByCategory={netByCategory}
          rolloverByCategory={data.rolloverByCategory}
          historicalRecurring={data.historicalRecurring}
          month={selectedMonth}
          year={selectedYear}
        />

        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          <CategorySummary transactions={data.currentMonthTransactions} />
          <MonthlySpendingComparison
            currentMonthTransactions={data.currentMonthTransactions}
            previousMonthTransactions={data.previousMonthTransactions}
            budgets={data.budgets}
            month={selectedMonth}
            year={selectedYear}
          />
        </div>
      </div>
    </div>
  )
}
