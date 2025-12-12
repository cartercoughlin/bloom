"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"

interface Transaction {
  amount: number
  transaction_type: string
  category_id: string | null
  categories: {
    name: string
    color: string
    icon: string | null
  } | null
}

interface SpendingByCategoryProps {
  transactions: Transaction[]
}

export function SpendingByCategory({ transactions }: SpendingByCategoryProps) {
  // Calculate spending by category
  const categorySpending: Record<string, { name: string; amount: number; color: string; icon: string | null }> = {}

  transactions
    .filter((t) => t.transaction_type === "debit")
    .forEach((t) => {
      if (t.categories) {
        const key = t.categories.name
        if (!categorySpending[key]) {
          categorySpending[key] = {
            name: t.categories.name,
            amount: 0,
            color: t.categories.color,
            icon: t.categories.icon,
          }
        }
        categorySpending[key].amount += Number(t.amount)
      }
    })

  const chartData = Object.values(categorySpending)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8) // Top 8 categories

  const totalSpending = chartData.reduce((sum, item) => sum + item.amount, 0)

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="text-base md:text-lg">Spending by Category</CardTitle>
          <CardDescription className="text-xs md:text-sm">No expenses recorded this month</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48 md:h-64">
          <p className="text-muted-foreground text-xs md:text-sm">Import transactions to see spending breakdown</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3 md:pb-6">
        <CardTitle className="text-base md:text-lg">Spending by Category</CardTitle>
        <CardDescription className="text-xs md:text-sm">Top categories this month</CardDescription>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pb-4 md:pb-6">
        <ChartContainer
          config={chartData.reduce(
            (acc, item) => ({
              ...acc,
              [item.name]: {
                label: item.name,
                color: item.color,
              },
            }),
            {},
          )}
          className="h-40 sm:h-48 lg:h-64"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="amount"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius="70%"
                label={({ name, value, percent }) => {
                  if (percent < 0.05) return null // Hide labels for slices < 5%
                  return `$${Number(value).toFixed(0)}`
                }}
                labelLine={false}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <ChartTooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const data = payload[0]
                  const item = chartData.find((d) => d.name === data.name)
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs md:text-sm font-medium">
                          {item?.icon} {data.name}
                        </span>
                        <span className="text-xs md:text-sm font-bold">${Number(data.value).toFixed(2)}</span>
                      </div>
                    </div>
                  )
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>

        <div className="mt-3 md:mt-4 space-y-1.5 md:space-y-2">
          {chartData.map((item) => (
            <div key={item.name} className="flex items-center justify-between text-xs md:text-sm">
              <div className="flex items-center gap-1.5 md:gap-2">
                <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="truncate">
                  {item.icon} {item.name}
                </span>
              </div>
              <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                <span className="font-medium">${item.amount.toFixed(2)}</span>
                <span className="text-muted-foreground w-8 md:w-10 text-right">{((item.amount / totalSpending) * 100).toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
