import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { BudgetList } from "@/components/budget-list"
import { BudgetOverview } from "@/components/budget-overview"

export default async function BudgetsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login")
  }

  const currentDate = new Date()
  const currentMonth = currentDate.getMonth() + 1
  const currentYear = currentDate.getFullYear()

  // Get budgets for current month
  const { data: budgets } = await supabase
    .from("budgets")
    .select(
      `
      *,
      categories (
        id,
        name,
        color,
        icon
      )
    `,
    )
    .eq("month", currentMonth)
    .eq("year", currentYear)

  // Get all categories
  const { data: categories } = await supabase.from("categories").select("*").order("name")

  // Get transactions for current month
  const firstDay = new Date(currentYear, currentMonth - 1, 1).toISOString().split("T")[0]
  const lastDay = new Date(currentYear, currentMonth, 0).toISOString().split("T")[0]

  // Get all transactions for current month (both debit and credit for net calculation)
  const { data: transactions } = await supabase
    .from("transactions")
    .select("category_id, amount, transaction_type")
    .gte("date", firstDay)
    .lte("date", lastDay)

  // Calculate net spending by category (income - expenses)
  const netByCategory: Record<string, { income: number; expenses: number; net: number }> = {}
  transactions?.forEach((tx) => {
    if (tx.category_id) {
      if (!netByCategory[tx.category_id]) {
        netByCategory[tx.category_id] = { income: 0, expenses: 0, net: 0 }
      }

      if (tx.transaction_type === "credit") {
        netByCategory[tx.category_id].income += Number(tx.amount)
      } else if (tx.transaction_type === "debit") {
        netByCategory[tx.category_id].expenses += Number(tx.amount)
      }

      netByCategory[tx.category_id].net =
        netByCategory[tx.category_id].income - netByCategory[tx.category_id].expenses
    }
  })

  return (
    <div className="container mx-auto p-3 md:p-6 max-w-7xl pb-20 md:pb-6">
      <div className="mb-4 md:mb-8">
        <h1 className="text-xl md:text-3xl font-bold mb-1 md:mb-2">Budget</h1>
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
          month={currentMonth}
          year={currentYear}
        />
      </div>
    </div>
  )
}
