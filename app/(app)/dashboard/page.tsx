import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SpendingOverview } from "@/components/spending-overview"
import { SpendingByCategory } from "@/components/spending-by-category"
import { MonthlyTrend } from "@/components/monthly-trend"

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  const currentDate = new Date()
  const currentMonth = currentDate.getMonth() + 1
  const currentYear = currentDate.getFullYear()

  // Get current month date range
  const firstDay = new Date(currentYear, currentMonth - 1, 1).toISOString().split("T")[0]
  const lastDay = new Date(currentYear, currentMonth, 0).toISOString().split("T")[0]

  // Get all transactions for current month
  const { data: currentMonthTransactions, error: transactionsError } = await supabase
    .from("transactions")
    .select(
      `
      *,
      categories (
        name,
        color,
        icon
      )
    `,
    )
    .gte("date", firstDay)
    .lte("date", lastDay)
    .order("date", { ascending: false })

  console.log("[v0] Current month transactions:", currentMonthTransactions?.length || 0)
  if (transactionsError) {
    console.error("[v0] Error fetching transactions:", transactionsError)
  }

  // Get last 6 months of transactions for trend
  const sixMonthsAgo = new Date(currentYear, currentMonth - 7, 1).toISOString().split("T")[0]
  const { data: trendTransactions, error: trendError } = await supabase
    .from("transactions")
    .select("date, amount, transaction_type")
    .gte("date", sixMonthsAgo)

  if (trendError) {
    console.error("[v0] Error fetching trend data:", trendError)
  }

  // Get budgets for current month
  const { data: budgets, error: budgetsError } = await supabase
    .from("budgets")
    .select(
      `
      amount,
      category_id,
      categories (
        name
      )
    `,
    )
    .eq("month", currentMonth)
    .eq("year", currentYear)

  if (budgetsError) {
    console.error("[v0] Error fetching budgets:", budgetsError)
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
        <SpendingOverview transactions={currentMonthTransactions || []} budgets={budgets || []} />

        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          <SpendingByCategory transactions={currentMonthTransactions || []} />
          <MonthlyTrend transactions={trendTransactions || []} />
        </div>
      </div>
    </div>
  )
}
