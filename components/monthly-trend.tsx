"use client"

import { memo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { usePrivacy } from "@/contexts/privacy-context"

interface Transaction {
  date: string
  amount: number
  transaction_type: string
}

interface Account {
  account_type: string
  balance: number
}

interface MonthlyTrendProps {
  transactions: Transaction[]
  accounts: Account[]
}

function MonthlyTrendInner({ transactions, accounts }: MonthlyTrendProps) {
  const { privacyMode } = usePrivacy()

  // Calculate current net worth from account balances
  const currentNetWorth = accounts.reduce((sum, acc) => {
    const bal = Number(acc.balance)
    return sum + (acc.account_type === "liability" ? -Math.abs(bal) : bal)
  }, 0)

  // Sum net change per month from transactions
  // credit = money in (increases balance), debit = money out (decreases balance)
  const monthlyChange: Record<string, number> = {}
  transactions.forEach((t) => {
    const date = new Date(t.date)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    if (!monthlyChange[key]) monthlyChange[key] = 0
    const amt = Number(t.amount)
    if (t.transaction_type === "credit") {
      monthlyChange[key] += amt
    } else {
      monthlyChange[key] -= amt
    }
  })

  // Sort months newest to oldest, then work backwards from current net worth
  const sortedMonths = Object.keys(monthlyChange).sort().reverse()
  if (sortedMonths.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="text-base md:text-lg">Net Worth</CardTitle>
          <CardDescription className="text-xs md:text-sm">Net worth over time</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48 md:h-64">
          <p className="text-muted-foreground text-xs md:text-sm">No transaction history available</p>
        </CardContent>
      </Card>
    )
  }

  // Build data points from newest month backwards
  const dataPoints: { monthKey: string; label: string; netWorth: number }[] = []
  let runningNetWorth = currentNetWorth

  for (const monthKey of sortedMonths) {
    const [y, m] = monthKey.split("-").map(Number)
    const label = new Date(y, m - 1).toLocaleString("default", { month: "short", year: "numeric" })
    dataPoints.push({ monthKey, label, netWorth: Math.round(runningNetWorth * 100) / 100 })
    // Subtract this month's net change to get end-of-previous-month value
    runningNetWorth -= monthlyChange[monthKey]
  }

  // Reverse to chronological order
  const chartData = dataPoints.reverse()

  return (
    <Card>
      <CardHeader className="pb-3 md:pb-6">
        <CardTitle className="text-base md:text-lg">Net Worth</CardTitle>
        <CardDescription className="text-xs md:text-sm">Net worth trend over the last 6 months</CardDescription>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pb-4 md:pb-6">
        <ChartContainer
          config={{
            netWorth: {
              label: "Net Worth",
              color: "#3B82F6",
            },
          }}
          className="h-48 sm:h-64 lg:h-80"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" className="text-[10px] md:text-xs" />
              <YAxis
                className="text-[10px] md:text-xs"
                tickFormatter={(value) =>
                  privacyMode ? "••••" : `$${(value / 1000).toFixed(0)}k`
                }
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) =>
                      privacyMode
                        ? "••••"
                        : `$${Number(value).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                    }
                    labelFormatter={(label) => label}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="netWorth"
                stroke="#3B82F6"
                strokeWidth={2}
                fill="url(#netWorthGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export const MonthlyTrend = memo(MonthlyTrendInner)
