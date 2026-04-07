"use client"

import { memo, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { usePrivacy } from "@/contexts/privacy-context"

interface Account {
  account_name: string
  account_type: string
  balance: number
}

interface ChartPoint {
  month: string
  netWorth: number
}

interface MonthlyTrendProps {
  accounts: Account[]
}

function MonthlyTrendInner({ accounts }: MonthlyTrendProps) {
  const { privacyMode } = usePrivacy()
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)

  // Current net worth from live account balances (always accurate)
  const currentNetWorth = accounts.reduce((sum, acc) => {
    const bal = Number(acc.balance)
    return sum + (acc.account_type === "liability" ? -Math.abs(bal) : bal)
  }, 0)

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/net-worth-history")
        if (!res.ok) throw new Error("Failed to fetch")
        const data: ChartPoint[] = await res.json()

        // If we have historical data, use it — replace the latest month
        // with the live current net worth for accuracy
        if (data.length > 0) {
          const now = new Date()
          const currentMonthLabel = now.toLocaleString("default", { month: "short", year: "numeric" })
          const lastPoint = data[data.length - 1]

          if (lastPoint.month === currentMonthLabel) {
            // Update the latest month with live balance
            lastPoint.netWorth = Math.round(currentNetWorth * 100) / 100
          } else {
            // Add current month as a new point
            data.push({ month: currentMonthLabel, netWorth: Math.round(currentNetWorth * 100) / 100 })
          }
          setChartData(data)
        } else {
          // No history yet — show just the current month
          const now = new Date()
          setChartData([{
            month: now.toLocaleString("default", { month: "short", year: "numeric" }),
            netWorth: Math.round(currentNetWorth * 100) / 100,
          }])
        }
      } catch {
        // Fallback: show current net worth only
        const now = new Date()
        setChartData([{
          month: now.toLocaleString("default", { month: "short", year: "numeric" }),
          netWorth: Math.round(currentNetWorth * 100) / 100,
        }])
      } finally {
        setLoading(false)
      }
    }

    if (accounts.length > 0) {
      loadHistory()
    } else {
      setLoading(false)
    }
  }, [accounts, currentNetWorth])

  if (accounts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="text-base md:text-lg">Net Worth</CardTitle>
          <CardDescription className="text-xs md:text-sm">Net worth over time</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48 md:h-64">
          <p className="text-muted-foreground text-xs md:text-sm">No accounts linked yet</p>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="text-base md:text-lg">Net Worth</CardTitle>
          <CardDescription className="text-xs md:text-sm">Net worth over time</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48 md:h-64">
          <div className="animate-pulse h-full w-full bg-muted rounded" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3 md:pb-6">
        <CardTitle className="text-base md:text-lg">Net Worth</CardTitle>
        <CardDescription className="text-xs md:text-sm">
          {chartData.length > 1 ? "Net worth trend over time" : "Net worth — history will build over time"}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pb-4 md:pb-6">
        {/* Current net worth callout */}
        <div className="text-center mb-4 py-2 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-muted-foreground">Current Net Worth</p>
          <p className={`text-xl md:text-2xl font-bold ${currentNetWorth >= 0 ? "text-blue-600" : "text-red-600"}`}>
            {privacyMode
              ? "••••••"
              : `$${currentNetWorth.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
        </div>

        {chartData.length > 1 && (
          <ChartContainer
            config={{
              netWorth: {
                label: "Net Worth",
                color: "#3B82F6",
              },
            }}
            className="h-48 sm:h-56 lg:h-64"
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
                <XAxis dataKey="month" className="text-[10px] md:text-xs" />
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
                          ? "••••••"
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
        )}
      </CardContent>
    </Card>
  )
}

export const MonthlyTrend = memo(MonthlyTrendInner)
