"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { TrendingDown, TrendingUp, DollarSign, Target } from "lucide-react"
import { PrivateAmount } from "./private-amount"
import { usePrivacy } from "@/contexts/privacy-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { HistoricalRecurringData } from "@/lib/budget/historical-recurring"

interface Budget {
  id: string
  amount: number
  category_id: string
  enable_rollover?: boolean
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
  historicalRecurring?: HistoricalRecurringData
  month: number
  year: number
}

export function BudgetOverview({ budgets, netByCategory, rolloverByCategory = {}, historicalRecurring, month, year }: BudgetOverviewProps) {
  const { privacyMode } = usePrivacy()
  const [showDetailModal, setShowDetailModal] = useState(false)

  // Calculate total rollover from previous month (only for budgets with rollover enabled)
  const budgetsWithRollover = budgets.filter(b => b.enable_rollover !== false) // Default to true
  const rolloverCategoryIds = new Set(budgetsWithRollover.map(b => b.category_id))
  const totalRollover = Object.entries(rolloverByCategory)
    .filter(([categoryId]) => rolloverCategoryIds.has(categoryId))
    .reduce((sum, [_, amount]) => sum + amount, 0)

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

  // Calculate expected spending using historical recurring data when available
  // Historical data tells us what recurring expenses to expect for the full month,
  // even if they haven't hit yet (e.g., phone bill on the 20th)
  const calculateExpectedSpending = () => {
    if (percentageThroughMonth === null) return 0

    // If we have historical data, use it to determine the recurring/variable split
    // and scale both linearly since recurring expenses are spread throughout the month
    if (historicalRecurring && historicalRecurring.monthsUsed > 0) {
      const expectedRecurring = historicalRecurring.total
      const expectedVariable = Math.max(0, totalBudget - expectedRecurring)

      // Both recurring and variable scale linearly through the month
      // because recurring expenses are spread throughout (rent on 1st, Netflix on 5th, phone on 20th, etc.)
      return (expectedRecurring + expectedVariable) * (percentageThroughMonth / 100)
    }

    // Fallback: no historical data available
    // Use actual recurring spent so far as the baseline (old behavior)
    return totalRecurring + ((totalBudget - totalRecurring) * (percentageThroughMonth / 100))
  }

  const expectedSpending = calculateExpectedSpending()

  const difference = totalBudget - totalSpent
  const differencePercent = totalBudget > 0 ? (difference / totalBudget) * 100 : 0
  const pacingDifference = percentageThroughMonth !== null ? totalSpent - expectedSpending : 0
  const pacingPercent = totalBudget > 0 && percentageThroughMonth !== null
    ? (pacingDifference / totalBudget) * 100
    : 0

  return (
    <>
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

      <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setShowDetailModal(true)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2">
          <div>
            <CardTitle className="text-sm md:text-base font-medium">Progress</CardTitle>
            {percentageThroughMonth !== null && (
              <div className="flex items-center gap-1 mt-1">
                {totalSpent <= expectedSpending ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs md:text-sm text-green-600 font-medium">On Track</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-xs md:text-sm text-red-600 font-medium">
                      {Math.abs(pacingPercent).toFixed(0)}% over pace
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

            {/* Expected spending line - outside overflow container */}
            {percentageThroughMonth !== null && (
              <div
                className="absolute -top-1 -bottom-1 w-1 bg-blue-600 dark:bg-blue-400 z-10 shadow-lg"
                style={{
                  left: `${Math.min((expectedSpending / totalBudget) * 100, 100)}%`
                }}
                title={privacyMode ? 'Expected: ••••' : `Expected: $${expectedSpending.toFixed(2)}`}
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

    {/* Detailed Budget Breakdown Modal */}
    <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Budget Breakdown</DialogTitle>
          <DialogDescription>
            Detailed overview of your spending progress
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Budget vs Spending */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Budget vs Spending</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Total Budget</p>
                <PrivateAmount amount={totalBudget} className="text-lg font-bold" />
                {totalRollover > 0 && (
                  <p className="text-xs text-green-600">
                    +<PrivateAmount amount={totalRollover} prefix="$" className="inline" /> rollover
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Total Spent</p>
                <PrivateAmount amount={totalSpent} className="text-lg font-bold text-red-600" />
                <p className="text-xs text-muted-foreground">{percentageUsed.toFixed(1)}% used</p>
              </div>
            </div>
          </div>

          {/* Spending Breakdown */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Spending Breakdown</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Recurring</span>
                <PrivateAmount amount={totalRecurring} className="text-sm font-medium" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Variable</span>
                <PrivateAmount amount={totalVariable} className="text-sm font-medium" />
              </div>
            </div>
          </div>

          {/* Pacing Analysis */}
          {percentageThroughMonth !== null && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Pacing Analysis</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Days through month</span>
                  <span className="text-sm font-medium">{percentageThroughMonth.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Expected spending</span>
                  <PrivateAmount amount={expectedSpending} className="text-sm font-medium" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Actual spending</span>
                  <PrivateAmount amount={totalSpent} className="text-sm font-medium" />
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm font-semibold">Pacing difference</span>
                  <div className="text-right">
                    <PrivateAmount
                      amount={Math.abs(pacingDifference)}
                      prefix={pacingDifference >= 0 ? '+$' : '-$'}
                      className={`text-sm font-bold ${pacingDifference <= 0 ? 'text-green-600' : 'text-red-600'}`}
                    />
                    <p className={`text-xs ${pacingDifference <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Math.abs(pacingPercent).toFixed(1)}% {pacingDifference <= 0 ? 'ahead' : 'behind'} pace
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Historical Recurring Info */}
          {historicalRecurring && historicalRecurring.monthsUsed > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Expected Monthly Recurring</h3>
              <p className="text-xs text-muted-foreground">
                Based on {historicalRecurring.monthsUsed} month{historicalRecurring.monthsUsed !== 1 ? 's' : ''} of history
              </p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Avg. monthly recurring</span>
                  <PrivateAmount amount={historicalRecurring.total} className="text-sm font-medium" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Expected variable</span>
                  <PrivateAmount amount={Math.max(0, totalBudget - historicalRecurring.total)} className="text-sm font-medium" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Recurring so far</span>
                  <PrivateAmount amount={totalRecurring} className="text-sm font-medium" />
                </div>
                {historicalRecurring.total > totalRecurring && (
                  <div className="flex justify-between items-center text-blue-600">
                    <span className="text-sm">Recurring still expected</span>
                    <PrivateAmount amount={historicalRecurring.total - totalRecurring} className="text-sm font-medium" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Overall Status */}
          <div className="space-y-2 pt-4 border-t">
            <h3 className="font-semibold text-sm">Overall Budget Status</h3>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold">
                {difference >= 0 ? 'Remaining' : 'Over Budget'}
              </span>
              <div className="text-right">
                <PrivateAmount
                  amount={Math.abs(difference)}
                  className={`text-lg font-bold ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}
                />
                <p className={`text-xs ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {Math.abs(differencePercent).toFixed(1)}% {difference >= 0 ? 'under' : 'over'} budget
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </>
  )
}
