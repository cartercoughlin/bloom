import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { BudgetList } from "@/components/budget-list"
import { AccountSummary } from "@/components/account-summary"
import { BudgetAllocatorWrapper } from "@/components/budget-allocator-wrapper"

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

  // Calculate account balances from transactions instead of manual entry
  const { data: allTransactions } = await supabase
    .from("transactions")
    .select("amount, transaction_type, bank, account, institution")
    .eq("user_id", user.id)
    .eq("hidden", false)

  // Group transactions by account and calculate balances
  const accountBalances: Record<string, number> = {}
  allTransactions?.forEach((tx) => {
    const accountKey = `${tx.bank || tx.institution || 'Unknown'} - ${tx.account || 'Main'}`
    if (!accountBalances[accountKey]) {
      accountBalances[accountKey] = 0
    }
    
    // Credit transactions add to balance, debit transactions subtract
    if (tx.transaction_type === 'credit') {
      accountBalances[accountKey] += Number(tx.amount)
    } else {
      accountBalances[accountKey] -= Number(tx.amount)
    }
  })

  // Calculate total available (assuming all accounts are checking/assets, no liabilities for now)
  const totalAvailable = Object.values(accountBalances).reduce((sum, balance) => sum + balance, 0)

  // Calculate total already allocated this month
  const totalAllocated = budgets?.reduce((sum, budget) => sum + Number(budget.allocated_amount || 0), 0) || 0

  // Available to budget = total available - already allocated
  const availableToBudget = totalAvailable - totalAllocated

  return (
    <div className="container mx-auto p-3 md:p-6 max-w-7xl pb-20 md:pb-6">
      <div className="mb-4 md:mb-8">
        <h1 className="text-xl md:text-3xl font-bold mb-1 md:mb-2">Budget</h1>
        <p className="text-muted-foreground text-xs md:text-sm">Allocate your money and track spending</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Account Summary & Allocation */}
        <div className="space-y-6">
          <AccountSummary 
            accountBalances={accountBalances}
            totalAvailable={totalAvailable}
          />
          
          <BudgetAllocatorWrapper
            budgets={budgets?.map(b => ({
              id: b.id,
              name: b.categories?.name || 'Unknown Category',
              allocated_amount: b.allocated_amount || 0,
              spent_amount: spendingByCategory[b.category_id] || 0,
              available_amount: b.available_amount || 0
            })) || []}
            availableToAllocate={availableToBudget}
          />
        </div>

        {/* Right Column - Budget List */}
        <div>
          <BudgetList
            budgets={budgets || []}
            categories={categories || []}
            spending={spendingByCategory}
            month={currentMonth}
            year={currentYear}
          />
        </div>
      </div>
    </div>
  )
}
