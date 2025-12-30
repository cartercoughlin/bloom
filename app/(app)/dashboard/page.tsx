'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { SpendingOverview } from "@/components/spending-overview"
import { CategorySummary } from "@/components/category-summary"
import { MonthlyTrend } from "@/components/monthly-trend"
import { BudgetOverview } from "@/components/budget-overview"
import { cache } from "@/lib/capacitor"
import { Skeleton } from "@/components/ui/skeleton"
import { useMonth } from "@/contexts/month-context"

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [currentMonthTransactions, setCurrentMonthTransactions] = useState<any[]>([])
  const [trendTransactions, setTrendTransactions] = useState<any[]>([])
  const [budgets, setBudgets] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [netByCategory, setNetByCategory] = useState<any>({})
  const [rolloverByCategory, setRolloverByCategory] = useState<any>({})
  const { selectedMonth, selectedYear, isCurrentMonth } = useMonth()

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
        const cacheKey = `dashboard-${selectedYear}-${selectedMonth}`
        const cachedData = await cache.getJSON<any>(cacheKey)
        if (cachedData) {
          setCurrentMonthTransactions(cachedData.currentMonthTransactions || [])
          setTrendTransactions(cachedData.trendTransactions || [])
          setBudgets(cachedData.budgets || [])
          setCategories(cachedData.categories || [])
          
          // Calculate net by category from cached data
          const categoryTotals: any = {}
          ;(cachedData.currentMonthTransactions || []).forEach((tx: any) => {
            if (!tx.category_id || tx.hidden) return
            
            if (!categoryTotals[tx.category_id]) {
              categoryTotals[tx.category_id] = {
                income: 0,
                expenses: 0,
                net: 0,
                recurringExpenses: 0,
                variableExpenses: 0,
              }
            }
            
            if (tx.transaction_type === "credit") {
              categoryTotals[tx.category_id].income += tx.amount
            } else {
              categoryTotals[tx.category_id].expenses += tx.amount
              if (tx.recurring) {
                categoryTotals[tx.category_id].recurringExpenses += tx.amount
              } else {
                categoryTotals[tx.category_id].variableExpenses += tx.amount
              }
            }
            
            categoryTotals[tx.category_id].net = categoryTotals[tx.category_id].income - categoryTotals[tx.category_id].expenses
          })
          setNetByCategory(categoryTotals)
          
          setLoading(false)
        }

        // Get selected month date range
        const firstDay = new Date(selectedYear, selectedMonth - 1, 1).toISOString().split("T")[0]
        const lastDay = new Date(selectedYear, selectedMonth, 0).toISOString().split("T")[0]

        // Fetch fresh data
        const [transactionsResult, trendResult, budgetsResult, categoriesResult] = await Promise.all([
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
            .lte("date", lastDay)
            .or("deleted.is.null,deleted.eq.false")
            .order("date", { ascending: false }),

          supabase
            .from("transactions")
            .select("date, amount, transaction_type")
            .eq("user_id", user.id)
            .gte("date", new Date(selectedYear, selectedMonth - 7, 1).toISOString().split("T")[0])
            .or("deleted.is.null,deleted.eq.false"),

          supabase
            .from("budgets")
            .select(`
              id,
              amount,
              category_id,
              month,
              year,
              categories (
                name,
                color,
                icon
              )
            `)
            .eq("user_id", user.id)
            .eq("month", selectedMonth)
            .eq("year", selectedYear),

          supabase
            .from("categories")
            .select("*")
            .eq("user_id", user.id)
            .order("name")
        ])

        const newData = {
          currentMonthTransactions: transactionsResult.data || [],
          trendTransactions: trendResult.data || [],
          budgets: budgetsResult.data || [],
          categories: categoriesResult.data || []
        }

        // Update state
        setCurrentMonthTransactions(newData.currentMonthTransactions)
        setTrendTransactions(newData.trendTransactions)
        setBudgets(newData.budgets)
        setCategories(newData.categories)

        console.log('Dashboard data loaded:', {
          transactions: newData.currentMonthTransactions.length,
          budgets: newData.budgets.length,
          categories: newData.categories.length
        })

        // Calculate net by category
        const categoryTotals: any = {}
        newData.currentMonthTransactions.forEach((tx: any) => {
          if (!tx.category_id || tx.hidden) return
          
          if (!categoryTotals[tx.category_id]) {
            categoryTotals[tx.category_id] = {
              income: 0,
              expenses: 0,
              net: 0,
              recurringExpenses: 0,
              variableExpenses: 0,
            }
          }
          
          if (tx.transaction_type === "credit") {
            categoryTotals[tx.category_id].income += tx.amount
          } else {
            categoryTotals[tx.category_id].expenses += tx.amount
            if (tx.recurring) {
              categoryTotals[tx.category_id].recurringExpenses += tx.amount
            } else {
              categoryTotals[tx.category_id].variableExpenses += tx.amount
            }
          }
          
          categoryTotals[tx.category_id].net = categoryTotals[tx.category_id].income - categoryTotals[tx.category_id].expenses
        })
        
        console.log('Category totals calculated:', categoryTotals)
        console.log('Sample transactions:', newData.currentMonthTransactions.slice(0, 3))
        setNetByCategory(categoryTotals)

        setLoading(false)

        // Cache the data
        await cache.setJSON(cacheKey, newData)
      } catch (error) {
        console.error("[v0] Error loading dashboard:", error)
        setLoading(false)
      }
    }

    loadData()
  }, [router, selectedMonth, selectedYear])

  if (loading && currentMonthTransactions.length === 0) {
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
          budgets={budgets || []}
          netByCategory={netByCategory}
          rolloverByCategory={rolloverByCategory}
          month={selectedMonth}
          year={selectedYear}
        />

        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          <CategorySummary transactions={currentMonthTransactions} />
          <MonthlyTrend transactions={trendTransactions} />
        </div>
      </div>
    </div>
  )
}
