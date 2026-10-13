'use client'

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { BudgetList } from "@/components/budget-list"
import { BudgetOverview } from "@/components/budget-overview"
import { SavingsGoalsList } from "@/components/savings-goals-list"
import { Skeleton } from "@/components/ui/skeleton"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { Button } from "@/components/ui/button"
import { FolderKanban, Loader2 } from "lucide-react"
import { useMonth } from "@/contexts/month-context"
import { calculateHistoricalRecurring, HistoricalRecurringData } from "@/lib/budget/historical-recurring"
import { useAppData, CACHE_KEYS } from "@/contexts/app-data-context"
import { useCachedData } from "@/hooks/use-cached-data"
import { computeCategoryTotals, CategoryTotals } from "@/lib/compute-category-totals"

const BUDGET_CACHE_VERSION = "v4"
const EMPTY_HISTORICAL: HistoricalRecurringData = { byCategory: {}, total: 0, monthsUsed: 0 }

interface BudgetPageData {
  budgets: any[]
  savingsGoals: any[]
  categories: any[]
  netByCategory: CategoryTotals
  spendingByCategory: Record<string, number>
  rolloverByCategory: Record<string, number>
  historicalRecurring: HistoricalRecurringData
}

export default function BudgetsPage() {
  const router = useRouter()
  const [editBudgetId, setEditBudgetId] = useState<string | null>(null)
  const { selectedMonth, selectedYear, isCurrentMonth } = useMonth()
  const appData = useAppData()

  // Auto-create budgets for new month from previous month
  const autoCreateBudgetsFromPreviousMonth = async (supabase: any, userId: string) => {
    // Get previous month
    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1
    const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear

    // Check if budgets exist for selected month
    const { data: existingBudgets } = await supabase
      .from("budgets")
      .select("id")
      .eq("user_id", userId)
      .eq("month", selectedMonth)
      .eq("year", selectedYear)

    // If budgets already exist, don't create
    if (existingBudgets && existingBudgets.length > 0) {
      return
    }

    // Get the most recent month's budgets to use as a template
    const { data: recentBudgetsCurrentYear } = await supabase
      .from("budgets")
      .select("month, year")
      .eq("user_id", userId)
      .eq("year", selectedYear)
      .lt("month", selectedMonth)
      .order("month", { ascending: false })
      .limit(1)

    let chosenTemplate = recentBudgetsCurrentYear?.[0]

    if (!chosenTemplate) {
      const { data: recentBudgetsPrevYear } = await supabase
        .from("budgets")
        .select("month, year")
        .eq("user_id", userId)
        .lt("year", selectedYear)
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(1)
      chosenTemplate = recentBudgetsPrevYear?.[0]
    }

    if (!chosenTemplate) return

    // Get budgets for the current month to see what we're missing
    const [templateBudgetsResult, currentBudgetsResult] = await Promise.all([
      supabase
        .from("budgets")
        .select("category_id, amount, enable_rollover")
        .eq("user_id", userId)
        .eq("month", chosenTemplate.month)
        .eq("year", chosenTemplate.year),
      supabase
        .from("budgets")
        .select("category_id")
        .eq("user_id", userId)
        .eq("month", selectedMonth)
        .eq("year", selectedYear)
    ])

    const prevBudgets = templateBudgetsResult.data || []
    const currentBudgets = currentBudgetsResult.data || []

    if (prevBudgets.length === 0) return

    const currentCategoryIds = new Set(currentBudgets.map((b: any) => b.category_id))
    const budgetsToCreate = prevBudgets.filter((b: any) => !currentCategoryIds.has(b.category_id))

    if (budgetsToCreate.length === 0) return

    // Create missing budgets for current month
    const newBudgets = budgetsToCreate.map((budget: any) => ({
      user_id: userId,
      category_id: budget.category_id,
      amount: budget.amount,
      enable_rollover: budget.enable_rollover ?? true,
      month: selectedMonth,
      year: selectedYear
    }))

    await supabase.from("budgets").insert(newBudgets)
  }

  const budgetCacheKey = `${CACHE_KEYS.budgets}${selectedYear}-${selectedMonth}-${BUDGET_CACHE_VERSION}`

  const fetchBudgetData = useCallback(async (): Promise<BudgetPageData | null> => {
    const supabase = createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      router.push("/auth/login")
      return null
    }

    await autoCreateBudgetsFromPreviousMonth(supabase, user.id)

    const firstDay = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
    const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1
    const nextYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear
    const nextMonthFirstDay = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

    const [budgetsResult, categoriesResult, transactionsResult, rolloverResponse] = await Promise.all([
      supabase
        .from("budgets")
        .select(`
          *,
          categories (
            id,
            name,
            color,
            icon,
            is_rollover,
            target_amount
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

      supabase
        .from("transactions")
        .select("id, category_id, amount, transaction_type, recurring, hidden, date")
        .eq("user_id", user.id)
        .gte("date", firstDay)
        .lt("date", nextMonthFirstDay)
        .not("deleted", "eq", true),

      // Server-side rollover: 2 DB queries instead of 12+ recursive ones
      fetch(`/api/rollover?month=${selectedMonth}&year=${selectedYear}`, { cache: "no-store" }),
    ])

    if (transactionsResult.error) {
      console.error("Error fetching transactions:", transactionsResult.error)
    }

    const rollover = rolloverResponse.ok ? await rolloverResponse.json() : {}
    const categoryTotals = computeCategoryTotals(transactionsResult.data || [])

    const spending: Record<string, number> = {}
    Object.entries(categoryTotals).forEach(([categoryId, totals]) => {
      spending[categoryId] = Math.max(0, totals.expenses - totals.income)
    })

    const regularBudgets = (budgetsResult.data || []).filter(
      (budget: any) => !budget.categories?.is_rollover
    )

    // Historical recurring averages drive pacing, which is only shown for the current month
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
        3 // Look back 3 months
      )
    }

    // Every rollover category appears in savings goals, even without a budget record this month
    const allCategories = categoriesResult.data || []
    const savingsGoalBudgets = allCategories
      .filter((c: any) => c.is_rollover)
      .map((cat: any) => {
        const existingBudget = (budgetsResult.data || []).find((b: any) => b.category_id === cat.id)
        if (existingBudget) return existingBudget

        // Virtual budget for display purposes
        return {
          id: `virtual-${cat.id}`,
          category_id: cat.id,
          amount: 0,
          user_id: user.id,
          month: selectedMonth,
          year: selectedYear,
          categories: cat
        }
      })

    return {
      budgets: regularBudgets,
      savingsGoals: savingsGoalBudgets,
      categories: allCategories,
      netByCategory: categoryTotals,
      spendingByCategory: spending,
      rolloverByCategory: rollover,
      historicalRecurring: historicalRecurringData
    }
  }, [router, selectedMonth, selectedYear])

  const { data, loading, refreshing, refresh } = useCachedData(budgetCacheKey, fetchBudgetData)

  // Budget edits change what the dashboard shows too
  const handleBudgetDataChanged = useCallback(() => {
    appData.markStale([CACHE_KEYS.dashboard, CACHE_KEYS.transactions])
    refresh()
  }, [appData.markStale, refresh])

  const budgets = data?.budgets || []
  const savingsGoals = data?.savingsGoals || []
  const categories = data?.categories || []
  const netByCategory = data?.netByCategory || {}
  const spendingByCategory = data?.spendingByCategory || {}
  const rolloverByCategory = data?.rolloverByCategory || {}
  const historicalRecurring = data?.historicalRecurring || EMPTY_HISTORICAL

  if (loading && !data) {
    return (
      <div className="container mx-auto p-3 md:p-6 max-w-7xl pb-20 md:pb-6">
        <div className="mb-4 md:mb-8">
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-3 md:p-6 max-w-7xl pb-20 md:pb-6">
      <PullToRefresh onRefresh={refresh} />
      <div className="flex items-center justify-between mb-4 md:mb-8">
        <div>
          <h1 className="text-xl md:text-3xl font-bold mb-1 md:mb-2 text-green-600 flex items-center gap-2">
            Budget
            {refreshing && (
              <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Updating
              </span>
            )}
          </h1>
          <p className="text-muted-foreground text-xs md:text-sm">
            {isCurrentMonth() ? 'Set spending limits and track progress by category' : 'Review past budgets and spending'}
          </p>
        </div>
        <Link href="/categories">
          <Button variant="outline" className="text-xs md:text-sm h-8 md:h-10 px-2 md:px-4">
            <FolderKanban className="mr-0 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden md:inline">Manage Categories</span>
            <span className="md:hidden">Categories</span>
          </Button>
        </Link>
      </div>

      <div className="space-y-6">
        <BudgetOverview
          budgets={budgets || []}
          netByCategory={netByCategory}
          rolloverByCategory={rolloverByCategory}
          historicalRecurring={historicalRecurring}
          month={selectedMonth}
          year={selectedYear}
        />

        <BudgetList
          budgets={budgets || []}
          categories={categories || []}
          netByCategory={netByCategory}
          spending={spendingByCategory}
          rolloverByCategory={rolloverByCategory}
          historicalRecurring={historicalRecurring}
          month={selectedMonth}
          year={selectedYear}
          editBudgetId={editBudgetId}
          onEditComplete={() => {
            setEditBudgetId(null)
          }}
          onRefresh={handleBudgetDataChanged}
          allBudgets={[...(budgets || []), ...(savingsGoals || [])]}
        />

        <SavingsGoalsList
          savingsGoals={savingsGoals || []}
          netByCategory={netByCategory}
          rolloverByCategory={rolloverByCategory}
          month={selectedMonth}
          year={selectedYear}
          onEdit={(goalId) => setEditBudgetId(goalId)}
          onRefresh={handleBudgetDataChanged}
        />
      </div>
    </div>
  )
}
