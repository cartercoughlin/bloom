'use client'

import { useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { createClient } from "@/lib/supabase/client"
import { Skeleton } from "@/components/ui/skeleton"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { SafeToSpend } from "@/components/dashboard/safe-to-spend"
import { CategoriesAtRisk } from "@/components/dashboard/categories-at-risk"
import { NeedsCategorization } from "@/components/dashboard/needs-categorization"
import { useMonth } from "@/contexts/month-context"
import { CACHE_KEYS } from "@/contexts/app-data-context"
import { useCachedData } from "@/hooks/use-cached-data"
import { Loader2 } from "lucide-react"
import { calculateHistoricalRecurring, HistoricalRecurringData } from "@/lib/budget/historical-recurring"
import { computeCategoryTotals } from "@/lib/compute-category-totals"
import { summarizeBudgets } from "@/lib/budget/summary"
import { buildMonthlyHistory, monthRange, HistoryBudget, HistoryTransaction } from "@/lib/budget/history"
import { fetchAllRows } from "@/lib/supabase/fetch-all"
import type { PacingHistory } from "@/lib/budget/pacing"
import { usePacingMode } from "@/hooks/use-pacing-mode"
import { PacingModeToggle } from "@/components/pacing-mode-toggle"

// Charts are lazy-loaded — Recharts is ~200KB and not needed for the first paint
const chartSkeleton = () => (
  <div className="border rounded-xl p-6">
    <Skeleton className="h-6 w-32 mb-2" />
    <Skeleton className="h-4 w-48 mb-4" />
    <Skeleton className="h-48 w-full" />
  </div>
)
const MonthlySpendingComparison = dynamic(
  () => import("@/components/monthly-spending-comparison").then(mod => ({ default: mod.MonthlySpendingComparison })),
  { loading: chartSkeleton, ssr: false }
)
const SpendingHistory = dynamic(
  () => import("@/components/dashboard/spending-history").then(mod => ({ default: mod.SpendingHistory })),
  { loading: chartSkeleton, ssr: false }
)
const NetWorthChart = dynamic(
  () => import("@/components/net-worth-chart").then(mod => ({ default: mod.NetWorthChart })),
  { loading: chartSkeleton, ssr: false }
)

const HISTORY_MONTHS = 6

interface DashboardData {
  // Selected month plus the 5 before it, for the pace and history charts
  historyTransactions: HistoryTransaction[]
  historyBudgets: HistoryBudget[]
  budgets: any[]
  rolloverByCategory: Record<string, number>
  historicalRecurring: HistoricalRecurringData
  uncategorizedCount: number
  pacingHistory: PacingHistory | null
}

const EMPTY_HISTORICAL: HistoricalRecurringData = { byCategory: {}, total: 0, monthsUsed: 0 }
const DASHBOARD_CACHE_VERSION = "v5"

const monthKey = (month: number, year: number) => `${year}-${String(month).padStart(2, "0")}`
const firstOfMonth = (month: number, year: number) => `${monthKey(month, year)}-01`

export default function DashboardPage() {
  const router = useRouter()
  const { selectedMonth, selectedYear, isCurrentMonth } = useMonth()
  const [pacingMode] = usePacingMode()

  const cacheKey = `${CACHE_KEYS.dashboard}${selectedYear}-${selectedMonth}-${DASHBOARD_CACHE_VERSION}`

  const fetchDashboardData = useCallback(async (): Promise<DashboardData | null> => {
    const supabase = createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      router.push("/auth/login")
      return null
    }

    const months = monthRange(selectedMonth, selectedYear, HISTORY_MONTHS)
    const historyStart = firstOfMonth(months[0].month, months[0].year)
    const next = new Date(selectedYear, selectedMonth, 1)
    const historyEnd = firstOfMonth(next.getMonth() + 1, next.getFullYear())

    const today = new Date()
    const isViewingCurrentMonth = selectedMonth === today.getMonth() + 1 && selectedYear === today.getFullYear()

    const [historyTransactions, historyBudgetsResult, budgetsResult, uncategorizedResult, rolloverResponse, pacingHistoryResponse] = await Promise.all([
      fetchAllRows<HistoryTransaction>((from, to) =>
        supabase
          .from("transactions")
          .select("category_id, amount, transaction_type, recurring, hidden, date")
          .eq("user_id", user.id)
          .gte("date", historyStart)
          .lt("date", historyEnd)
          .not("deleted", "is", true)
          .order("date")
          .order("id")
          .range(from, to)
      ),

      supabase
        .from("budgets")
        .select("category_id, amount, month, year, categories (is_rollover)")
        .eq("user_id", user.id)
        .gte("year", months[0].year)
        .lte("year", selectedYear),

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
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("category_id", null)
        .not("hidden", "is", true)
        .not("deleted", "is", true),

      fetch(`/api/rollover?month=${selectedMonth}&year=${selectedYear}`, { cache: "no-store" }),

      // When spending usually happens, for history pacing (current month only)
      isViewingCurrentMonth
        ? fetch(`/api/pacing-history?month=${selectedMonth}&year=${selectedYear}`, { cache: "no-store" })
        : Promise.resolve(null),
    ])

    const rollover = rolloverResponse.ok ? await rolloverResponse.json() : {}
    const pacingHistory: PacingHistory | null = pacingHistoryResponse?.ok ? await pacingHistoryResponse.json() : null

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

    const historyMonthKeys = new Set(months.map(m => monthKey(m.month, m.year)))
    const historyBudgets = (historyBudgetsResult.data || [])
      .filter((b: any) => !b.categories?.is_rollover && historyMonthKeys.has(monthKey(b.month, b.year)))
      .map(({ categories, ...b }: any) => b as HistoryBudget)

    return {
      historyTransactions,
      historyBudgets,
      budgets: regularBudgets,
      rolloverByCategory: rollover,
      historicalRecurring: historicalRecurringData,
      uncategorizedCount: uncategorizedResult.count || 0,
      pacingHistory,
    }
  }, [router, selectedMonth, selectedYear])

  const { data, loading, refreshing, refresh } = useCachedData(cacheKey, fetchDashboardData)

  const derived = useMemo(() => {
    if (!data) return null
    const currentKey = monthKey(selectedMonth, selectedYear)
    const prev = new Date(selectedYear, selectedMonth - 2, 1)
    const previousKey = monthKey(prev.getMonth() + 1, prev.getFullYear())
    const currentMonthTransactions = data.historyTransactions.filter(tx => tx.date.startsWith(currentKey))
    const previousMonthTransactions = data.historyTransactions.filter(tx => tx.date.startsWith(previousKey))

    const summary = summarizeBudgets(
      data.budgets,
      computeCategoryTotals(currentMonthTransactions),
      data.rolloverByCategory,
      data.historicalRecurring,
      selectedMonth,
      selectedYear,
      pacingMode === "history" ? data.pacingHistory : null
    )

    // Spending that isn't counted toward any budget yet
    const uncategorizedThisMonth = currentMonthTransactions
      .filter(tx => !tx.category_id && !tx.hidden && tx.transaction_type !== "credit")
      .reduce((sum, tx) => sum + Number(tx.amount), 0)

    return {
      summary,
      currentMonthTransactions,
      previousMonthTransactions,
      uncategorizedThisMonth,
      history: buildMonthlyHistory(data.historyTransactions, data.historyBudgets, selectedMonth, selectedYear, HISTORY_MONTHS),
    }
  }, [data, selectedMonth, selectedYear, pacingMode])

  if (loading && !data) {
    return (
      <div className="container mx-auto p-3 md:p-6 max-w-7xl pb-20 md:pb-6">
        <div className="mb-4 md:mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="space-y-4 md:space-y-6">
          <Skeleton className="h-44 w-full" />
          <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!data || !derived) return null
  const { summary } = derived
  const monthLabel = new Date(selectedYear, selectedMonth - 1).toLocaleString("default", { month: "long", year: "numeric" })

  return (
    <div className="container mx-auto p-3 md:p-6 max-w-7xl pb-20 md:pb-6">
      <PullToRefresh onRefresh={refresh} />
      <div className="mb-4 md:mb-6">
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
          {isCurrentMonth() ? "How this month is going" : `Looking back at ${monthLabel}`}
        </p>
        {isCurrentMonth() && <PacingModeToggle className="mt-2" />}
      </div>

      <div className="space-y-4 md:space-y-6">
        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          <SafeToSpend summary={summary} />
          <div className="space-y-4 md:space-y-6">
            <CategoriesAtRisk summary={summary} />
            <NeedsCategorization
              count={data.uncategorizedCount}
              amountThisMonth={derived.uncategorizedThisMonth}
            />
          </div>
        </div>

        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          <MonthlySpendingComparison
            currentMonthTransactions={derived.currentMonthTransactions}
            previousMonthTransactions={derived.previousMonthTransactions}
            budgets={data.budgets}
            month={selectedMonth}
            year={selectedYear}
            budgetTotal={summary.totalBudget}
            projectedTotal={summary.progress.isCurrentMonth ? summary.projectedTotal : undefined}
            expectedByDay={summary.expectedByDay ?? undefined}
          />
          <SpendingHistory history={derived.history} />
        </div>

        <NetWorthChart variant="card" />
      </div>
    </div>
  )
}
