"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts"
import { usePrivacy } from "@/contexts/privacy-context"

interface Transaction {
  date: string
  amount: number
  transaction_type: string
}

interface MonthlyTrendProps {
  transactions: Transaction[]
}

export function MonthlyTrend({ transactions }: MonthlyTrendProps) {
  const { privacyMode } = usePrivacy()

  // Group by month
  const monthlyData: Record<
    string,
    {
      month: string
      income: number
      expenses: number
    }
  > = {}

  transactions.forEach((t) => {
    const date = new Date(t.date)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    const monthLabel = date.toLocaleString("default", { month: "short", year: "numeric" })

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        month: monthLabel,
        income: 0,
        expenses: 0,
      }
    }

    if (t.transaction_type === "credit") {
      monthlyData[monthKey].income += Number(t.amount)
    } else {
      monthlyData[monthKey].expenses += Number(t.amount)
    }
  })

  const chartData = Object.keys(monthlyData)
    .sort()
    .map((key) => monthlyData[key])

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="text-base md:text-lg">Monthly Trend</CardTitle>
          <CardDescription className="text-xs md:text-sm">Income vs expenses over time</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48 md:h-64">
          <p className="text-muted-foreground text-xs md:text-sm">No transaction history available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3 md:pb-6">
        <CardTitle className="text-base md:text-lg">Monthly Trend</CardTitle>
        <CardDescription className="text-xs md:text-sm">Income vs expenses over the last 6 months</CardDescription>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pb-4 md:pb-6">
        <ChartContainer
          config={{
            income: {
              label: "Income",
              color: "#10B981",
            },
            expenses: {
              label: "Expenses",
              color: "#EF4444",
            },
          }}
          className="h-48 sm:h-64 lg:h-80"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-[10px] md:text-xs" />
              <YAxis className="text-[10px] md:text-xs" tickFormatter={(value) => privacyMode ? '••••' : `$${value.toLocaleString('en-US')}`} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => privacyMode ? '••••' : `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    labelFormatter={(label) => label}
                  />
                }
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
