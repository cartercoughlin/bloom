import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { BudgetOverview } from "@/components/budget-overview"
import { BudgetList } from "@/components/budget-list"

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

  // Get spending for current month
  const firstDay = new Date(currentYear, currentMonth - 1, 1).toISOString().split("T")[0]
  const lastDay = new Date(currentYear, currentMonth, 0).toISOString().split("T")[0]

  const { data: transactions } = await supabase
    .from("transactions")
    .select("category_id, amount, transaction_type")
    .gte("date", firstDay)
    .lte("date", lastDay)
    .eq("transaction_type", "debit")

  // Calculate spending by category
  const spendingByCategory: Record<string, number> = {}
  transactions?.forEach((tx) => {
    if (tx.category_id) {
      spendingByCategory[tx.category_id] = (spendingByCategory[tx.category_id] || 0) + Number(tx.amount)
    }
  })

  return (
    <div className="container mx-auto p-3 md:p-6 max-w-7xl pb-24 md:pb-6">
      <div className="mb-4 md:mb-8">
        <h1 className="text-xl md:text-3xl font-bold mb-1 md:mb-2">Budget</h1>
        <p className="text-muted-foreground text-xs md:text-sm">
          Manage your monthly budget for {currentDate.toLocaleString("default", { month: "long", year: "numeric" })}
        </p>
      </div>

      <BudgetOverview budgets={budgets || []} spending={spendingByCategory} month={currentMonth} year={currentYear} />

      <div className="mt-6 md:mt-8">
        <BudgetList
          budgets={budgets || []}
          categories={categories || []}
          spending={spendingByCategory}
          month={currentMonth}
          year={currentYear}
        />
      </div>
    </div>
  )
}
