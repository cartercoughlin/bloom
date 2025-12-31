'use client'

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { BudgetList } from "@/components/budget-list"
import { BudgetOverview } from "@/components/budget-overview"
import { SavingsGoalsList } from "@/components/savings-goals-list"
import { cache } from "@/lib/capacitor"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { FolderKanban } from "lucide-react"
import { useMonth } from "@/contexts/month-context"

export default function BudgetsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [budgets, setBudgets] = useState<any[]>([])
  const [savingsGoals, setSavingsGoals] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [netByCategory, setNetByCategory] = useState<any>({})
  const [spendingByCategory, setSpendingByCategory] = useState<any>({})
  const [rolloverByCategory, setRolloverByCategory] = useState<any>({})
  const [editBudgetId, setEditBudgetId] = useState<string | null>(null)
  const { selectedMonth, selectedYear, isCurrentMonth } = useMonth()

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

    // Get previous month's budgets (including rollover categories)
    const { data: prevBudgets } = await supabase
      .from("budgets")
      .select("category_id, amount")
      .eq("user_id", userId)
      .eq("month", prevMonth)
      .eq("year", prevYear)

    if (!prevBudgets || prevBudgets.length === 0) {
      return
    }

    // Create budgets for current month (including rollover/savings goal categories)
    const newBudgets = prevBudgets.map((budget: any) => ({
      user_id: userId,
      category_id: budget.category_id,
      amount: budget.amount,
      month: selectedMonth,
      year: selectedYear
    }))

    await supabase.from("budgets").insert(newBudgets)
  }

  // Calculate rollover from previous month (cumulative)
  const calculateRollover = useCallback(async (supabase: any, userId: string, targetMonth: number, targetYear: number, depth = 0): Promise<Record<string, number>> => {
    // Limit recursion to 12 months to avoid infinite loops and performance issues
    if (depth > 12) return {}

    const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1
    const prevYear = targetMonth === 1 ? targetYear - 1 : targetYear

    // Get rollover from the month BEFORE the previous month
    const previousMonthsRollover = await calculateRollover(supabase, userId, prevMonth, prevYear, depth + 1)

    // Get previous month's budgets
    const { data: prevBudgets } = await supabase
      .from("budgets")
      .select("category_id, amount")
      .eq("user_id", userId)
      .eq("month", prevMonth)
      .eq("year", prevYear)

    if (!prevBudgets || prevBudgets.length === 0) {
      return {}
    }

    // Get previous month's transactions
    const prevFirstDay = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
    const prevNextMonth = prevMonth === 12 ? 1 : prevMonth + 1
    const prevNextYear = prevMonth === 12 ? prevYear + 1 : prevYear
    const prevNextMonthFirstDay = `${prevNextYear}-${String(prevNextMonth).padStart(2, '0')}-01`

    const { data: prevTransactions } = await supabase
      .from("transactions")
      .select("category_id, amount, transaction_type, hidden")
      .eq("user_id", userId)
      .gte("date", prevFirstDay)
      .lt("date", prevNextMonthFirstDay)
      .or("deleted.is.null,deleted.eq.false")

    // Calculate spending by category for the previous month
    const prevSpending: Record<string, number> = {}
    prevTransactions?.forEach((tx: any) => {
      if (tx.hidden) return
      if (tx.category_id) {
        if (!prevSpending[tx.category_id]) {
          prevSpending[tx.category_id] = 0
        }
        if (tx.transaction_type === 'debit') {
          prevSpending[tx.category_id] += Number(tx.amount)
        } else if (tx.transaction_type === 'credit') {
          prevSpending[tx.category_id] -= Number(tx.amount)
        }
      }
    })

    // Calculate rollover: (Base Budget + Previous Rollover) - Spending
    const rollover: Record<string, number> = {}
    prevBudgets.forEach((budget: any) => {
      const spent = prevSpending[budget.category_id] || 0
      const prevRollover = previousMonthsRollover[budget.category_id] || 0
      const totalAvailable = Number(budget.amount) + prevRollover
      const remaining = totalAvailable - spent

      // Only roll over positive amounts
      if (remaining > 0) {
        rollover[budget.category_id] = remaining
      }
    })

    return rollover
  }, [])

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const supabase = createClient()

      // Check authentication
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        router.push("/auth/login")
        return
      }

      // Try to load from cache first for instant display
      if (showLoading) {
        const cacheKey = `budgets-${selectedYear}-${selectedMonth}`
        const cachedData = await cache.getJSON<any>(cacheKey)
        if (cachedData) {
          setBudgets(cachedData.budgets || [])
          setSavingsGoals(cachedData.savingsGoals || [])
          setCategories(cachedData.categories || [])
          setNetByCategory(cachedData.netByCategory || {})
          setSpendingByCategory(cachedData.spendingByCategory || {})
          setRolloverByCategory(cachedData.rolloverByCategory || {})
          setLoading(false)
        }
      }

      // Auto-create budgets from previous month if needed
      await autoCreateBudgetsFromPreviousMonth(supabase, user.id)

      // Calculate rollover from previous month (cumulative)
      const rollover = await calculateRollover(supabase, user.id, selectedMonth, selectedYear)

      // Get transactions for selected month
      const firstDay = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1
      const nextYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear
      const nextMonthFirstDay = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

      console.log(`Querying transactions for range: ${firstDay} to ${nextMonthFirstDay}`)

      // Fetch fresh data
      const [budgetsResult, categoriesResult, transactionsResult] = await Promise.all([
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
          .not("deleted", "eq", true) // More robust way to say "not deleted"
      ])

      if (transactionsResult.error) {
        console.error("Error fetching transactions:", transactionsResult.error)
      }

      console.log(`Fetched ${transactionsResult.data?.length || 0} transactions`)
      if (transactionsResult.data && transactionsResult.data.length > 0) {
        console.log("Sample transaction:", {
          id: transactionsResult.data[0].id,
          category_id: transactionsResult.data[0].category_id,
          amount: transactionsResult.data[0].amount,
          type: transactionsResult.data[0].transaction_type
        })
      }

      // Calculate net by category with recurring/variable breakdown
      const categoryTotals: Record<string, {
        income: number
        expenses: number
        net: number
        recurringExpenses: number
        variableExpenses: number
      }> = {}

      let categorizedCount = 0
      transactionsResult.data?.forEach((tx) => {
        if (tx.hidden) return

        if (tx.category_id) {
          categorizedCount++
          if (!categoryTotals[tx.category_id]) {
            categoryTotals[tx.category_id] = {
              income: 0,
              expenses: 0,
              net: 0,
              recurringExpenses: 0,
              variableExpenses: 0,
            }
          }

          const amount = Number(tx.amount)
          const categoryData = categoryTotals[tx.category_id]

          if (tx.transaction_type === 'credit') {
            categoryData.income += amount
          } else {
            categoryData.expenses += amount
            if (tx.recurring) {
              categoryData.recurringExpenses += amount
            } else {
              categoryData.variableExpenses += amount
            }
          }

          categoryData.net = categoryData.income - categoryData.expenses
        }
      })

      console.log(`Categorized ${categorizedCount} out of ${transactionsResult.data?.length || 0} transactions`)
      console.log("Budget category IDs:", budgetsResult.data?.map(b => b.category_id))
      console.log("Category totals keys:", Object.keys(categoryTotals))

      const spending: Record<string, number> = {}
      Object.entries(categoryTotals).forEach(([categoryId, data]) => {
        spending[categoryId] = Math.max(0, data.expenses - data.income)
      })

      const regularBudgets = (budgetsResult.data || []).filter(
        (budget: any) => !budget.categories?.is_rollover
      )
      const savingsGoalBudgets = (budgetsResult.data || []).filter(
        (budget: any) => budget.categories?.is_rollover
      )

      const newData = {
        budgets: regularBudgets,
        savingsGoals: savingsGoalBudgets,
        categories: categoriesResult.data || [],
        netByCategory: categoryTotals,
        spendingByCategory: spending,
        rolloverByCategory: rollover
      }

      setBudgets(newData.budgets)
      setSavingsGoals(newData.savingsGoals)
      setCategories(newData.categories)
      setNetByCategory(newData.netByCategory)
      setSpendingByCategory(newData.spendingByCategory)
      setRolloverByCategory(newData.rolloverByCategory)

      const cacheKey = `budgets-${selectedYear}-${selectedMonth}`
      await cache.setJSON(cacheKey, newData)
    } catch (error) {
      console.error("Error loading budgets:", error)
    } finally {
      setLoading(false)
    }
  }, [router, selectedMonth, selectedYear, calculateRollover])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading && budgets.length === 0) {
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
      <div className="flex items-center justify-between mb-4 md:mb-8">
        <div>
          <h1 className="text-xl md:text-3xl font-bold mb-1 md:mb-2 text-green-600">Budget</h1>
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
          month={selectedMonth}
          year={selectedYear}
        />

        <BudgetList
          budgets={budgets || []}
          categories={categories || []}
          netByCategory={netByCategory}
          spending={spendingByCategory}
          rolloverByCategory={rolloverByCategory}
          month={selectedMonth}
          year={selectedYear}
          editBudgetId={editBudgetId}
          onEditComplete={() => {
            setEditBudgetId(null)
          }}
          onRefresh={() => loadData(false)}
          allBudgets={[...(budgets || []), ...(savingsGoals || [])]}
        />

        <SavingsGoalsList
          savingsGoals={savingsGoals || []}
          netByCategory={netByCategory}
          rolloverByCategory={rolloverByCategory}
          month={selectedMonth}
          year={selectedYear}
          onEdit={(goalId) => setEditBudgetId(goalId)}
          onRefresh={() => loadData(false)}
        />
      </div>
    </div>
  )
}
