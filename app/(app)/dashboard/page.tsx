'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { SpendingOverview } from "@/components/spending-overview"
import { SpendingByCategory } from "@/components/spending-by-category"
import { MonthlyTrend } from "@/components/monthly-trend"
import { cache } from "@/lib/capacitor"
import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [currentMonthTransactions, setCurrentMonthTransactions] = useState<any[]>([])
  const [trendTransactions, setTrendTransactions] = useState<any[]>([])
  const [budgets, setBudgets] = useState<any[]>([])
  const [currentDate] = useState(new Date())

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

        const currentMonth = currentDate.getMonth() + 1
        const currentYear = currentDate.getFullYear()

        // Try to load from cache first for instant display
        const cacheKey = `dashboard-${currentYear}-${currentMonth}`
        const cachedData = await cache.getJSON<any>(cacheKey)
        if (cachedData) {
          setCurrentMonthTransactions(cachedData.currentMonthTransactions || [])
          setTrendTransactions(cachedData.trendTransactions || [])
          setBudgets(cachedData.budgets || [])
          setLoading(false)
        }

        // Get current month date range
        const firstDay = new Date(currentYear, currentMonth - 1, 1).toISOString().split("T")[0]
        const lastDay = new Date(currentYear, currentMonth, 0).toISOString().split("T")[0]

        // Fetch fresh data
        const [transactionsResult, trendResult, budgetsResult] = await Promise.all([
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
            .gte("date", firstDay)
            .lte("date", lastDay)
            .order("date", { ascending: false }),

          supabase
            .from("transactions")
            .select("date, amount, transaction_type")
            .gte("date", new Date(currentYear, currentMonth - 7, 1).toISOString().split("T")[0]),

          supabase
            .from("budgets")
            .select(`
              amount,
              category_id,
              categories (
                name
              )
            `)
            .eq("month", currentMonth)
            .eq("year", currentYear)
        ])

        const newData = {
          currentMonthTransactions: transactionsResult.data || [],
          trendTransactions: trendResult.data || [],
          budgets: budgetsResult.data || []
        }

        // Update state
        setCurrentMonthTransactions(newData.currentMonthTransactions)
        setTrendTransactions(newData.trendTransactions)
        setBudgets(newData.budgets)
        setLoading(false)

        // Cache the data
        await cache.setJSON(cacheKey, newData)
      } catch (error) {
        console.error("[v0] Error loading dashboard:", error)
        setLoading(false)
      }
    }

    loadData()
  }, [router, currentDate])

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
        <h1 className="text-xl md:text-3xl font-bold mb-1 md:mb-2">Dashboard</h1>
        <p className="text-muted-foreground text-xs md:text-sm">
          Your spending insights for {currentDate.toLocaleString("default", { month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="space-y-4 md:space-y-6">
        <SpendingOverview transactions={currentMonthTransactions} budgets={budgets} />

        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          <SpendingByCategory transactions={currentMonthTransactions} />
          <MonthlyTrend transactions={trendTransactions} />
        </div>
      </div>
    </div>
  )
}
