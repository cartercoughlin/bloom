'use client'

import { useEffect, useState, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { createClient } from "@/lib/supabase/client"
import { CategorySummary } from "@/components/category-summary"
import { BudgetOverview } from "@/components/budget-overview"
import { cache } from "@/lib/capacitor"
import { Skeleton } from "@/components/ui/skeleton"
import { useMonth } from "@/contexts/month-context"
import { useAppData } from "@/contexts/app-data-context"
import { calculateHistoricalRecurring, HistoricalRecurringData } from "@/lib/budget/historical-recurring"
import { computeCategoryTotals } from "@/lib/compute-category-totals"

// Lazy-load the chart component — Recharts is ~200KB and not needed for initial render
const MonthlyTrend = dynamic(
  () => import("@/components/monthly-trend").then(mod => ({ default: mod.MonthlyTrend })),
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
  trendTransactions: any[]
  budgets: any[]
  categories: any[]
  rolloverByCategory: Record<string, number>
  historicalRecurring: HistoricalRecurringData
}

const EMPTY_HISTORICAL: HistoricalRecurringData = { byCategory: {}, total: 0, monthsUsed: 0 }
const EMPTY_DATA: DashboardData = {
  currentMonthTransactions: [],
  trendTransactions: [],
  budgets: [],
  categories: [],
  rolloverByCategory: {},
  historicalRecurring: EMPTY_HISTORICAL,
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData>(EMPTY_DATA)
  const { selectedMonth, selectedYear, isCurrentMonth } = useMonth()
  const appData = useAppData()
  const fetchingRef = useRef(false)

  // Memoize the category totals computation so it only reruns when transactions change
  const netByCategory = useMemo(
    () => computeCategoryTotals(data.currentMonthTransactions),
    [data.currentMonthTransactions]
  )

  const cacheKey = `dashboard-${selectedYear}-${selectedMonth}`

  useEffect(() => {
    async function loadData() {
      // Check in-memory context first (instant, no flicker)
      const cached = appData.get(cacheKey)
      if (cached) {
        setData(cached)
        setLoading(false)
        // If data is fresh enough, skip refetch entirely
        if (!appData.isStale(cacheKey)) return
      }

      // Prevent duplicate fetches
      if (fetchingRef.current) return
      fetchingRef.current = true

      try {
        const supabase = createClient()

        // Check authentication
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          router.push("/auth/login")
          return
        }

        // If no in-memory cache, try disk cache for instant display
        if (!cached) {
          const diskCached = await cache.getJSON<any>(cacheKey)
          if (diskCached) {
            setData({
              currentMonthTransactions: diskCached.currentMonthTransactions || [],
              trendTransactions: diskCached.trendTransactions || [],
              budgets: diskCached.budgets || [],
              categories: diskCached.categories || [],
              rolloverByCategory: diskCached.rolloverByCategory || {},
              historicalRecurring: diskCached.historicalRecurring || EMPTY_HISTORICAL,
            })
            setLoading(false)
          }
        }

        // Get selected month date range
        const firstDay = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
        const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1
        const nextYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear
        const nextMonthFirstDay = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

        // Get trend start date (6 months prior)
        const trendStartMonth = selectedMonth - 6
        const trendStartYear = trendStartMonth <= 0 ? selectedYear - 1 : selectedYear
        const trendMonth = trendStartMonth <= 0 ? trendStartMonth + 12 : trendStartMonth
        const trendStartDay = `${trendStartYear}-${String(trendMonth).padStart(2, '0')}-01`

        // Fetch everything in parallel — including rollover via API route
        const [transactionsResult, trendResult, budgetsResult, categoriesResult, rolloverResponse] = await Promise.all([
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
            .select("date, amount, transaction_type, hidden, personal_finance_category, category_detailed, description")
            .eq("user_id", user.id)
            .gte("date", trendStartDay)
            .lt("date", nextMonthFirstDay)
            .or("hidden.is.null,hidden.eq.false")
            .or("deleted.is.null,deleted.eq.false"),

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

          fetch(`/api/rollover?month=${selectedMonth}&year=${selectedYear}`),
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
          trendTransactions: trendResult.data || [],
          budgets: regularBudgets,
          categories: categoriesResult.data || [],
          rolloverByCategory: rollover,
          historicalRecurring: historicalRecurringData,
        }

        setData(newData)
        setLoading(false)

        // Cache in both memory (instant nav) and disk (app restart)
        appData.set(cacheKey, newData)
        await cache.setJSON(cacheKey, newData)
      } catch (error) {
        console.error("[Dashboard] Error loading data:", error)
        setLoading(false)
      } finally {
        fetchingRef.current = false
      }
    }

    loadData()
  }, [selectedMonth, selectedYear])

  if (loading && data.currentMonthTransactions.length === 0) {
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
      <div className="mb-4 md:mb-8">
        <h1 className="text-xl md:text-3xl font-bold mb-1 md:mb-2 text-green-600">Dashboard</h1>
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
          <MonthlyTrend transactions={data.trendTransactions} />
        </div>
      </div>
    </div>
  )
}
