"use client"

import { memo, useMemo } from "react"
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { PrivateAmount } from "@/components/private-amount"
import { usePrivacy } from "@/contexts/privacy-context"

interface Transaction {
  amount: number
  category_id?: string | null
  date: string
  transaction_type: string
  hidden?: boolean | null
  recurring?: boolean | null
}

interface Budget {
  category_id: string
}

interface MonthlySpendingComparisonProps {
  currentMonthTransactions: Transaction[]
  previousMonthTransactions: Transaction[]
  budgets: Budget[]
  month: number
  year: number
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate()
}

function getPreviousMonth(month: number, year: number) {
  if (month === 1) {
    return { month: 12, year: year - 1 }
  }

  return { month: month - 1, year }
}

function calculateBudgetSpending(categoryTotals: Record<string, { income: number; recurring: number; variable: number }>) {
  return Object.values(categoryTotals).reduce((total, category) => {
    const netRecurringExpenses = Math.max(0, category.recurring - category.income)
    const netVariableExpenses =
      category.income > category.recurring
        ? Math.max(0, category.variable - (category.income - category.recurring))
        : category.variable

    return total + netRecurringExpenses + netVariableExpenses
  }, 0)
}

function addTransactionToTotals(
  categoryTotals: Record<string, { income: number; recurring: number; variable: number }>,
  transaction: Transaction,
) {
  if (!transaction.category_id) return

  if (!categoryTotals[transaction.category_id]) {
    categoryTotals[transaction.category_id] = { income: 0, recurring: 0, variable: 0 }
  }

  const category = categoryTotals[transaction.category_id]
  const amount = Number(transaction.amount || 0)

  if (transaction.transaction_type === "credit") {
    category.income += amount
  } else if (transaction.recurring) {
    category.recurring += amount
  } else {
    category.variable += amount
  }
}

function buildCumulativeSeries(
  currentMonthTransactions: Transaction[],
  previousMonthTransactions: Transaction[],
  budgetCategoryIds: Set<string>,
  month: number,
  year: number,
) {
  const previous = getPreviousMonth(month, year)
  const daysInCurrentMonth = getDaysInMonth(month, year)
  const daysInPreviousMonth = getDaysInMonth(previous.month, previous.year)
  const now = new Date()
  const isActualCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()
  const latestCurrentDay = isActualCurrentMonth ? now.getDate() : daysInCurrentMonth
  const currentTotals: Record<string, { income: number; recurring: number; variable: number }> = {}
  const previousTotals: Record<string, { income: number; recurring: number; variable: number }> = {}
  const currentTransactionsByDay = groupBudgetTransactionsByDay(currentMonthTransactions, budgetCategoryIds)
  const previousTransactionsByDay = groupBudgetTransactionsByDay(previousMonthTransactions, budgetCategoryIds)

  return Array.from({ length: daysInCurrentMonth }, (_, index) => {
    const day = index + 1

    if (day <= latestCurrentDay) {
      currentTransactionsByDay[day]?.forEach((transaction) => addTransactionToTotals(currentTotals, transaction))
    }

    if (day <= daysInPreviousMonth) {
      previousTransactionsByDay[day]?.forEach((transaction) => addTransactionToTotals(previousTotals, transaction))
    }

    return {
      day,
      current: day <= latestCurrentDay ? Math.round(calculateBudgetSpending(currentTotals) * 100) / 100 : null,
      previous: day <= daysInPreviousMonth ? Math.round(calculateBudgetSpending(previousTotals) * 100) / 100 : null,
    }
  })
}

function groupBudgetTransactionsByDay(transactions: Transaction[], budgetCategoryIds: Set<string>) {
  return transactions.reduce<Record<number, Transaction[]>>((byDay, transaction) => {
    if (transaction.hidden || !transaction.category_id || !budgetCategoryIds.has(transaction.category_id)) return byDay

    const day = Number(transaction.date.slice(0, 10).split("-")[2])
    if (!Number.isFinite(day)) return byDay

    if (!byDay[day]) byDay[day] = []
    byDay[day].push(transaction)
    return byDay
  }, {})
}

function MonthlySpendingComparisonInner({
  currentMonthTransactions,
  previousMonthTransactions,
  budgets,
  month,
  year,
}: MonthlySpendingComparisonProps) {
  const { privacyMode } = usePrivacy()
  const previous = getPreviousMonth(month, year)
  const currentMonthLabel = new Date(year, month - 1).toLocaleString("default", { month: "long" })
  const previousMonthLabel = new Date(previous.year, previous.month - 1).toLocaleString("default", { month: "long" })
  const budgetCategoryIds = useMemo(() => new Set(budgets.map((budget) => budget.category_id)), [budgets])

  const chartData = useMemo(
    () => buildCumulativeSeries(currentMonthTransactions, previousMonthTransactions, budgetCategoryIds, month, year),
    [currentMonthTransactions, previousMonthTransactions, budgetCategoryIds, month, year],
  )

  const latestCurrentPoint = [...chartData].reverse().find((point) => point.current !== null)
  const latestCurrentTotal = latestCurrentPoint?.current || 0
  const comparablePreviousTotal =
    chartData.find((point) => point.day === latestCurrentPoint?.day)?.previous ??
    chartData[chartData.length - 1]?.previous ??
    0
  const hasSpending = latestCurrentTotal > 0 || comparablePreviousTotal > 0

  if (!hasSpending) {
    return (
      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="text-base md:text-lg">Spending Pace</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Daily cumulative budget spending compared with {previousMonthLabel}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex h-48 items-center justify-center md:h-64">
          <p className="text-xs text-muted-foreground md:text-sm">No spending recorded for these months</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3 md:pb-6">
        <CardTitle className="text-base md:text-lg">Spending Pace</CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Daily cumulative budget spending vs. {previousMonthLabel}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-3 pb-4 sm:px-6 md:pb-6">
        <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">{currentMonthLabel}</div>
            <PrivateAmount amount={latestCurrentTotal} className="font-semibold text-green-600" />
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">{previousMonthLabel}</div>
            <PrivateAmount amount={comparablePreviousTotal} className="font-semibold text-orange-600" />
          </div>
        </div>

        <ChartContainer
          config={{
            current: {
              label: currentMonthLabel,
              color: "#16a34a",
            },
            previous: {
              label: previousMonthLabel,
              color: "#ea580c",
            },
          }}
          className="h-48 sm:h-56 lg:h-64"
        >
          <LineChart data={chartData} margin={{ left: 0, right: 10, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval="preserveStartEnd"
              tickFormatter={(value) => `${value}`}
              className="text-[10px] md:text-xs"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={privacyMode ? 42 : 52}
              tickFormatter={(value) => (privacyMode ? "••••" : currencyFormatter.format(Number(value)))}
              className="text-[10px] md:text-xs"
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(label) => `Day ${label}`}
                  formatter={(value, name) => (
                    <div className="flex min-w-[9rem] items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        {name === "current" ? currentMonthLabel : previousMonthLabel}
                      </span>
                      <span className="font-mono font-medium text-foreground">
                        {privacyMode ? "••••••" : currencyFormatter.format(Number(value))}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="previous"
              stroke="var(--color-previous)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="current"
              stroke="var(--color-current)"
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export const MonthlySpendingComparison = memo(MonthlySpendingComparisonInner)
