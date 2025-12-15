"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingDown, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react"

interface Transaction {
  amount: number
  transaction_type: string
  category_id?: string
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
  // Create a set of budgeted category IDs for quick lookup
  const budgetedCategoryIds = new Set(budgets.map(b => b.category_id))

  // Only count expenses for categories that have budgets (matches budget tab)
  const totalExpenses = transactions
    .filter((t) => t.transaction_type === "debit" && t.category_id && budgetedCategoryIds.has(t.category_id))
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0)
  const budgetRemaining = totalBudget - totalExpenses
  const budgetUsedPercentage = totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0

  return (
    <div className="grid gap-2 grid-cols-2 md:gap-4 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2">
          <CardTitle className="text-xs md:text-sm font-medium">Total Budget</CardTitle>
          <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-blue-600" />
        </CardHeader>
        <CardContent className="pb-2 md:pb-6">
          <div className="text-lg md:text-2xl font-bold text-blue-600">${totalBudget.toFixed(2)}</div>
          <p className="text-[10px] md:text-xs text-muted-foreground">Monthly allocation</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2">
          <CardTitle className="text-xs md:text-sm font-medium">Total Spent</CardTitle>
          <ArrowUpRight className="h-3 w-3 md:h-4 md:w-4 text-orange-600" />
        </CardHeader>
        <CardContent className="pb-2 md:pb-6">
          <div className="text-lg md:text-2xl font-bold text-orange-600">${totalExpenses.toFixed(2)}</div>
          <p className="text-[10px] md:text-xs text-muted-foreground">
            {budgetUsedPercentage > 0 ? `${budgetUsedPercentage.toFixed(0)}% of budget` : "No spending"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2">
          <CardTitle className="text-xs md:text-sm font-medium">Budget Remaining</CardTitle>
          {budgetRemaining >= 0 ? (
            <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-green-600" />
          ) : (
            <TrendingDown className="h-3 w-3 md:h-4 md:w-4 text-red-600" />
          )}
        </CardHeader>
        <CardContent className="pb-2 md:pb-6">
          <div className={`text-lg md:text-2xl font-bold ${budgetRemaining >= 0 ? "text-green-600" : "text-red-600"}`}>
            {budgetRemaining >= 0 ? "$" : "-$"}
            {Math.abs(budgetRemaining).toFixed(2)}
          </div>
          <p className="text-[10px] md:text-xs text-muted-foreground">
            {budgetRemaining >= 0 ? "Available to spend" : "Over budget"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2">
          <CardTitle className="text-xs md:text-sm font-medium">Budget Usage</CardTitle>
          {budgetUsedPercentage <= 100 ? (
            <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-blue-600" />
          ) : (
            <TrendingDown className="h-3 w-3 md:h-4 md:w-4 text-red-600" />
          )}
        </CardHeader>
        <CardContent className="pb-2 md:pb-6">
          <div className={`text-lg md:text-2xl font-bold ${budgetUsedPercentage <= 100 ? "text-blue-600" : "text-red-600"}`}>
            {budgetUsedPercentage.toFixed(0)}%
          </div>
          <p className="text-[10px] md:text-xs text-muted-foreground truncate">
            {budgetUsedPercentage <= 100 ? "On track" : "Exceeding budget"}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
