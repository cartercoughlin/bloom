"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { TrendingDown, TrendingUp, DollarSign, Target } from "lucide-react"

interface Budget {
  id: string
  amount: number
  categories: {
    id: string
    name: string
    color: string
    icon: string | null
  } | null
}

interface BudgetOverviewProps {
  budgets: Budget[]
  netByCategory: Record<string, {
    income: number
    expenses: number
    net: number
    recurringExpenses: number
    variableExpenses: number
  }>
  month: number
  year: number
}

export function BudgetOverview({ budgets, netByCategory, month, year }: BudgetOverviewProps) {
  const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0)
  // Use net spending (expenses - income) but don't go negative for income categories
  const totalSpent = budgets.reduce((sum, budget) => {
    const categoryData = netByCategory[budget.categories?.id || '']
    const categoryExpenses = categoryData?.expenses || 0
    const categoryIncome = categoryData?.income || 0
    const netSpending = Math.max(0, categoryExpenses - categoryIncome)
    return sum + netSpending
  }, 0)
  const remaining = totalBudget - totalSpent
  const percentageUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0

  // Calculate percentage through the month
  const getPercentageThroughMonth = () => {
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Only show expected marker if viewing current month
    if (month !== currentMonth || year !== currentYear) {
      return null
    }

    const currentDay = now.getDate()
    const daysInMonth = new Date(year, month, 0).getDate()
    return (currentDay / daysInMonth) * 100
  }

  const percentageThroughMonth = getPercentageThroughMonth()

  return (
    <div className="grid gap-2 grid-cols-2 md:gap-4 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2">
          <CardTitle className="text-xs md:text-sm font-medium">Total Budget</CardTitle>
          <Target className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pb-2 md:pb-6">
          <div className="text-lg md:text-2xl font-bold">${totalBudget.toFixed(2)}</div>
          <p className="text-[10px] md:text-xs text-muted-foreground">This month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2">
          <CardTitle className="text-xs md:text-sm font-medium">Total Spent</CardTitle>
          <DollarSign className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pb-2 md:pb-6">
          <div className="text-lg md:text-2xl font-bold text-red-600">${totalSpent.toFixed(2)}</div>
          <p className="text-[10px] md:text-xs text-muted-foreground">{percentageUsed.toFixed(1)}% of budget</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2">
          <CardTitle className="text-xs md:text-sm font-medium">Remaining</CardTitle>
          {remaining >= 0 ? (
            <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-green-600" />
          ) : (
            <TrendingDown className="h-3 w-3 md:h-4 md:w-4 text-red-600" />
          )}
        </CardHeader>
        <CardContent className="pb-2 md:pb-6">
          <div className={`text-lg md:text-2xl font-bold ${remaining >= 0 ? "text-green-600" : "text-red-600"}`}>
            ${Math.abs(remaining).toFixed(2)}
          </div>
          <p className="text-[10px] md:text-xs text-muted-foreground">{remaining >= 0 ? "Under budget" : "Over budget"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2">
          <CardTitle className="text-xs md:text-sm font-medium">Progress</CardTitle>
        </CardHeader>
        <CardContent className="pb-2 md:pb-6">
          <div className="relative">
            <Progress value={Math.min(percentageUsed, 100)} className="h-2" />
            {percentageThroughMonth !== null && (
              <div
                className="absolute -top-1 -bottom-1 w-0.5 bg-blue-500 z-10"
                style={{ left: `${Math.min(percentageThroughMonth, 100)}%` }}
                title={`Expected: $${(totalBudget * (percentageThroughMonth / 100)).toFixed(2)}`}
              />
            )}
          </div>
          <p className="text-[10px] md:text-xs text-muted-foreground mt-2">{percentageUsed.toFixed(1)}% used</p>
        </CardContent>
      </Card>
    </div>
  )
}
