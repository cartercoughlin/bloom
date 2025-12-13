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

  // Get account balances from account_balances table (synced from Tiller Balances sheet)
  // For budgeting, only include specific accounts for budgeting
  const budgetAccountNames = [
    "FirstView Checking (xxxx4583)",
    "CREDIT CARD (-3762) (xxxx3762)",
    "Citi /AAdvantage Platinum Select World Elite Mastercard (xxxx8364)"
  ]

  const { data: allAccounts } = await supabase
    .from("account_balances")
    .select("account_name, account_type, balance")
    .eq("user_id", user.id)

  // Filter to only budget accounts
  const accounts = allAccounts?.filter(account =>
    budgetAccountNames.includes(account.account_name)
  )

  // Group balances by account
  const accountBalances: Record<string, number> = {}
  let totalChecking = 0
  let totalLiabilities = 0

  accounts?.forEach((account) => {
    accountBalances[account.account_name] = Number(account.balance)

    // Sum checking accounts and liabilities (credit cards) separately
    if (account.account_type === 'liability') {
      totalLiabilities += Math.abs(Number(account.balance)) // Liabilities are stored as negative
    } else {
      totalChecking += Number(account.balance)
    }
  })

  // Total available for budgeting = checking - liabilities
  const totalAvailable = totalChecking - totalLiabilities

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
