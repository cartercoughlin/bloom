'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { BudgetList } from "@/components/budget-list"
import { BudgetOverview } from "@/components/budget-overview"
import { cache } from "@/lib/capacitor"
import { Skeleton } from "@/components/ui/skeleton"

export default function BudgetsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [budgets, setBudgets] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [netByCategory, setNetByCategory] = useState<any>({})
  const [spendingByCategory, setSpendingByCategory] = useState<any>({})
  const [currentDate] = useState(new Date())

  const currentMonth = currentDate.getMonth() + 1
  const currentYear = currentDate.getFullYear()

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

        // Try to load from cache first for instant display
        const cacheKey = `budgets-${currentYear}-${currentMonth}`
        const cachedData = await cache.getJSON<any>(cacheKey)
        if (cachedData) {
          setBudgets(cachedData.budgets || [])
          setCategories(cachedData.categories || [])
          setNetByCategory(cachedData.netByCategory || {})
          setSpendingByCategory(cachedData.spendingByCategory || {})
          setLoading(false)
        }

        // Get transactions for current month
        const firstDay = new Date(currentYear, currentMonth - 1, 1).toISOString().split("T")[0]
        const lastDay = new Date(currentYear, currentMonth, 0).toISOString().split("T")[0]

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
                icon
              )
            `)
            .eq("user_id", user.id)
            .eq("month", currentMonth)
            .eq("year", currentYear),

          supabase
            .from("categories")
            .select("*")
            .eq("user_id", user.id)
            .order("name"),

          supabase
            .from("transactions")
            .select("category_id, amount, transaction_type, recurring, hidden")
            .eq("user_id", user.id)
            .gte("date", firstDay)
            .lte("date", lastDay)
            .or("deleted.is.null,deleted.eq.false")
        ])

        // Calculate net by category with recurring/variable breakdown
        const categoryTotals: Record<string, {
          income: number
          expenses: number
          net: number
          recurringExpenses: number
          variableExpenses: number
        }> = {}

        transactionsResult.data?.forEach((tx) => {
          // Skip hidden transactions
          if (tx.hidden) return

          if (tx.category_id) {
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

              // Separate recurring from variable expenses
              if (tx.recurring) {
                categoryData.recurringExpenses += amount
              } else {
                categoryData.variableExpenses += amount
              }
            }

            categoryData.net = categoryData.income - categoryData.expenses
          }
        })

        // Also create simple spending record for backward compatibility
        const spending: Record<string, number> = {}
        Object.entries(categoryTotals).forEach(([categoryId, data]) => {
          spending[categoryId] = Math.max(0, data.expenses - data.income)
        })

        const newData = {
          budgets: budgetsResult.data || [],
          categories: categoriesResult.data || [],
          netByCategory: categoryTotals,
          spendingByCategory: spending
        }

        // Update state
        setBudgets(newData.budgets)
        setCategories(newData.categories)
        setNetByCategory(newData.netByCategory)
        setSpendingByCategory(newData.spendingByCategory)

        console.log('Budgets page data loaded:', {
          budgets: newData.budgets.length,
          categories: newData.categories.length,
          transactions: transactionsResult.data?.length
        })

        setLoading(false)

        // Cache the data
        await cache.setJSON(cacheKey, newData)
      } catch (error) {
        console.error("Error loading budgets:", error)
        setLoading(false)
      }
    }

    loadData()
  }, [router, currentDate])

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
      <div className="mb-4 md:mb-8">
        <h1 className="text-xl md:text-3xl font-bold mb-1 md:mb-2 text-green-600">Budget</h1>
        <p className="text-muted-foreground text-xs md:text-sm">Set spending limits and track progress by category</p>
      </div>

      <div className="space-y-6">
        <BudgetOverview
          budgets={budgets || []}
          netByCategory={netByCategory}
          month={currentMonth}
          year={currentYear}
        />

        <BudgetList
          budgets={budgets || []}
          categories={categories || []}
          netByCategory={netByCategory}
          spending={spendingByCategory}
          month={currentMonth}
          year={currentYear}
        />
      </div>
    </div>
  )
}
