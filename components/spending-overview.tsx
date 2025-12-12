"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingDown, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react"

interface Transaction {
  amount: number
  transaction_type: string
}

interface Budget {
  amount: number
  category_id: string
}

interface SpendingOverviewProps {
  transactions: Transaction[]
  budgets: Budget[]
}

export function SpendingOverview({ transactions, budgets }: SpendingOverviewProps) {
  const totalIncome = transactions
    .filter((t) => t.transaction_type === "credit")
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const totalExpenses = transactions
    .filter((t) => t.transaction_type === "debit")
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const netCashFlow = totalIncome - totalExpenses

  const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0)
  const budgetRemaining = totalBudget - totalExpenses
  const budgetUsedPercentage = totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0

  return (
    <div className="grid gap-2 grid-cols-2 md:gap-4 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2">
          <CardTitle className="text-xs md:text-sm font-medium">Total Income</CardTitle>
          <ArrowDownRight className="h-3 w-3 md:h-4 md:w-4 text-green-600" />
        </CardHeader>
        <CardContent className="pb-2 md:pb-6">
          <div className="text-lg md:text-2xl font-bold text-green-600">${totalIncome.toFixed(2)}</div>
          <p className="text-[10px] md:text-xs text-muted-foreground">This month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2">
          <CardTitle className="text-xs md:text-sm font-medium">Total Expenses</CardTitle>
          <ArrowUpRight className="h-3 w-3 md:h-4 md:w-4 text-red-600" />
        </CardHeader>
        <CardContent className="pb-2 md:pb-6">
          <div className="text-lg md:text-2xl font-bold text-red-600">${totalExpenses.toFixed(2)}</div>
          <p className="text-[10px] md:text-xs text-muted-foreground">
            {budgetUsedPercentage > 0 ? `${budgetUsedPercentage.toFixed(0)}% of budget` : "No budget"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2">
          <CardTitle className="text-xs md:text-sm font-medium">Net Cash Flow</CardTitle>
          {netCashFlow >= 0 ? (
            <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-green-600" />
          ) : (
            <TrendingDown className="h-3 w-3 md:h-4 md:w-4 text-red-600" />
          )}
        </CardHeader>
        <CardContent className="pb-2 md:pb-6">
          <div className={`text-lg md:text-2xl font-bold ${netCashFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
            {netCashFlow >= 0 ? "+" : "-"}${Math.abs(netCashFlow).toFixed(2)}
          </div>
          <p className="text-[10px] md:text-xs text-muted-foreground">Income - Expenses</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2">
          <CardTitle className="text-xs md:text-sm font-medium">Budget Status</CardTitle>
        </CardHeader>
        <CardContent className="pb-2 md:pb-6">
          <div className={`text-lg md:text-2xl font-bold ${budgetRemaining >= 0 ? "text-green-600" : "text-red-600"}`}>
            {budgetRemaining >= 0 ? "$" : "-$"}
            {Math.abs(budgetRemaining).toFixed(2)}
          </div>
          <p className="text-[10px] md:text-xs text-muted-foreground truncate">
            {budgetRemaining >= 0 ? "Remaining" : "Over"} • ${totalBudget.toFixed(0)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
