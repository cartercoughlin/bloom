"use client"

import { memo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts"
import { usePrivacy } from "@/contexts/privacy-context"

interface Transaction {
  date: string
  amount: number
  transaction_type: string
  personal_finance_category?: string | null
  category_detailed?: string | null
  description?: string | null
}

interface MonthlyTrendProps {
  transactions: Transaction[]
}

function MonthlyTrendInner({ transactions }: MonthlyTrendProps) {
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

  // Filter out inter-account transfers and credit card payments so they don't
  // inflate income/expense totals. Credit card payments are double-counted the
  // same way transfers are: checking shows a debit, card shows a credit.
  const EXCLUDED_CATEGORIES = new Set([
    "TRANSFER_IN",
    "TRANSFER_OUT",
    "LOAN_PAYMENTS",       // Plaid category for credit card / loan payments
    "BANK_FEES",           // Internal bank fees (not real spending decisions)
  ])
  const EXCLUDED_DESCRIPTION_PATTERNS = /\b(transfer|xfer|ach\s*(credit|debit|payment)|wire\s*(in|out)|internal\s*transfer|from\s*(checking|savings)|to\s*(checking|savings)|payment\s*thank\s*you|autopay|card\s*payment|credit\s*card\s*payment)\b/i

  function isExcluded(t: Transaction): boolean {
    // 1. New Plaid personal_finance_category (most reliable)
    if (t.personal_finance_category && EXCLUDED_CATEGORIES.has(t.personal_finance_category)) {
      return true
    }
    // 2. Old Plaid category_detailed field
    if (t.category_detailed) {
      const lower = t.category_detailed.toLowerCase()
      // Transfers: "Transfer > Debit", "Transfer > Credit", etc.
      if (lower.startsWith("transfer")) return true
      // Credit card payments: "Payment > Credit Card"
      if (lower.includes("credit card")) return true
    }
    // 3. Description keyword matching for older transactions without Plaid categories
    if (t.description && EXCLUDED_DESCRIPTION_PATTERNS.test(t.description)) {
      return true
    }
    return false
  }

  transactions.forEach((t) => {
    if (isExcluded(t)) {
      return
    }

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

export const MonthlyTrend = memo(MonthlyTrendInner)
