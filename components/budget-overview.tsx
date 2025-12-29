"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { TrendingDown, TrendingUp, DollarSign, Target } from "lucide-react"
import { PrivateAmount } from "./private-amount"
import { usePrivacy } from "@/contexts/privacy-context"

interface Budget {
  id: string
  amount: number
  category_id: string
  categories: {
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
  rolloverByCategory?: Record<string, number>
  month: number
  year: number
}

export function BudgetOverview({ budgets, netByCategory, rolloverByCategory = {}, month, year }: BudgetOverviewProps) {
  const { privacyMode } = usePrivacy()

  // Calculate total rollover from previous month
  const totalRollover = Object.values(rolloverByCategory).reduce((sum, amount) => sum + amount, 0)

  // Base budget (before rollover)
  const baseBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0)

  // Total budget including rollover
  const totalBudget = baseBudget + totalRollover
  
  // Calculate recurring and variable spending separately
  const { totalRecurring, totalVariable } = budgets.reduce((acc, budget) => {
    const categoryData = netByCategory?.[budget.category_id || '']
    const recurringExpenses = categoryData?.recurringExpenses || 0
    const variableExpenses = categoryData?.variableExpenses || 0
    const categoryIncome = categoryData?.income || 0
    
    // Use same logic as individual budgets: income offsets recurring first, then variable
    const netRecurringExpenses = Math.max(0, recurringExpenses - categoryIncome)
    const netVariableExpenses = categoryIncome > recurringExpenses
      ? Math.max(0, variableExpenses - (categoryIncome - recurringExpenses))
      : variableExpenses
    
    return {
      totalRecurring: acc.totalRecurring + netRecurringExpenses,
      totalVariable: acc.totalVariable + netVariableExpenses
    }
  }, { totalRecurring: 0, totalVariable: 0 })
  
  const totalSpent = totalRecurring + totalVariable
  const remaining = totalBudget - totalSpent
  const percentageUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0
  const recurringPercentage = totalBudget > 0 ? (totalRecurring / totalBudget) * 100 : 0
  const variablePercentage = totalBudget > 0 ? (totalVariable / totalBudget) * 100 : 0

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
          <CardTitle className="text-sm md:text-base font-medium">Total Budget</CardTitle>
          <Target className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pb-2 md:pb-6">
          <PrivateAmount amount={totalBudget} className="text-xl md:text-3xl font-bold" />
          {totalRollover > 0 ? (
            <p className="text-xs md:text-sm text-muted-foreground">
              <PrivateAmount amount={baseBudget} prefix="$" /> + <PrivateAmount amount={totalRollover} prefix="$" className="text-green-600" /> rollover
            </p>
          ) : (
            <p className="text-xs md:text-sm text-muted-foreground">This month</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2">
          <CardTitle className="text-sm md:text-base font-medium">Total Spent</CardTitle>
          <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pb-2 md:pb-6">
          <PrivateAmount amount={totalSpent} className="text-xl md:text-3xl font-bold text-red-600" />
          <p className="text-xs md:text-sm text-muted-foreground">{percentageUsed.toFixed(1)}% of budget</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2">
          <CardTitle className="text-sm md:text-base font-medium">Remaining</CardTitle>
          {remaining >= 0 ? (
            <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
          ) : (
            <TrendingDown className="h-4 w-4 md:h-5 md:w-5 text-red-600" />
          )}
        </CardHeader>
        <CardContent className="pb-2 md:pb-6">
          <PrivateAmount
            amount={Math.abs(remaining)}
            className={`text-xl md:text-3xl font-bold ${remaining >= 0 ? "text-green-600" : "text-red-600"}`}
          />
          <p className="text-xs md:text-sm text-muted-foreground">{remaining >= 0 ? "Under budget" : "Over budget"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2">
          <div>
            <CardTitle className="text-sm md:text-base font-medium">Progress</CardTitle>
            {percentageThroughMonth !== null && (
              <div className="flex items-center gap-1 mt-1">
                {totalSpent <= (totalRecurring + ((totalBudget - totalRecurring) * (percentageThroughMonth / 100))) ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs md:text-sm text-green-600 font-medium">On Track</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-xs md:text-sm text-red-600 font-medium">
                      {(((totalSpent - (totalRecurring + ((totalBudget - totalRecurring) * (percentageThroughMonth / 100)))) / totalBudget) * 100).toFixed(0)}% over pace
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pb-2 md:pb-6">
          <div className="relative">
            <div className="h-4 md:h-6 bg-gray-100 rounded-full overflow-hidden">
              {/* Recurring expenses baseline (always "committed") */}
              <div
                className="absolute left-0 top-0 h-full bg-gray-400 transition-all duration-300"
                style={{ width: `${Math.min(recurringPercentage, 100)}%` }}
                title={privacyMode ? 'Recurring: ••••' : `Recurring: $${totalRecurring.toFixed(2)}`}
              />

              {/* Variable expenses progress */}
              <div
                className="absolute top-0 h-full transition-all duration-300"
                style={{
                  left: `${Math.min(recurringPercentage, 100)}%`,
                  width: `${Math.min(variablePercentage, 100 - recurringPercentage)}%`,
                  background: 'linear-gradient(to right, #9ca3af, #22c55e)'
                }}
                title={privacyMode ? 'Variable: ••••' : `Variable: $${totalVariable.toFixed(2)}`}
              />
            </div>

            {/* Expected spending line (only for variable expenses) - outside overflow container */}
            {percentageThroughMonth !== null && (
              <div
                className="absolute -top-1 -bottom-1 w-1 bg-blue-600 dark:bg-blue-400 z-10 shadow-lg"
                style={{
                  left: `${Math.min(recurringPercentage + ((100 - recurringPercentage) * (percentageThroughMonth / 100)), 100)}%`
                }}
                title={privacyMode ? 'Expected variable: ••••' : `Expected variable: $${((totalBudget - totalRecurring) * (percentageThroughMonth / 100)).toFixed(2)}`}
              />
            )}
          </div>
          
          <div className="flex justify-between text-xs md:text-sm text-muted-foreground mt-2">
            <span>Recurring: <PrivateAmount amount={totalRecurring} prefix="$" /></span>
            <span className="text-green-600">Variable: <PrivateAmount amount={totalVariable} prefix="$" /></span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
