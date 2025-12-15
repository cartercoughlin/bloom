"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

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

interface IncomeByCategoryProps {
  transactions: Transaction[]
}

export function IncomeByCategory({ transactions }: IncomeByCategoryProps) {
  // Calculate income by category
  const categoryIncome: Record<string, { name: string; amount: number; color: string; icon: string | null }> = {}

  transactions
    .filter((t) => t.transaction_type === "credit")
    .forEach((t) => {
      if (t.categories) {
        const key = t.categories.name
        if (!categoryIncome[key]) {
          categoryIncome[key] = {
            name: t.categories.name,
            amount: 0,
            color: t.categories.color,
            icon: t.categories.icon,
          }
        }
        categoryIncome[key].amount += Number(t.amount)
      }
    })

  const chartData = Object.values(categoryIncome)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8) // Top 8 categories

  const totalIncome = chartData.reduce((sum, item) => sum + item.amount, 0)

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="text-base md:text-lg">Income by Category</CardTitle>
          <CardDescription className="text-xs md:text-sm">No income recorded this month</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-muted-foreground text-xs md:text-sm">Categorize income transactions to see breakdown</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3 md:pb-6">
        <CardTitle className="text-base md:text-lg">Income by Category</CardTitle>
        <CardDescription className="text-xs md:text-sm">Top income sources this month</CardDescription>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pb-4 md:pb-6">
        <div className="space-y-1.5 md:space-y-2">
          {chartData.map((item) => (
            <div key={item.name} className="flex items-center justify-between text-xs md:text-sm">
              <div className="flex items-center gap-1.5 md:gap-2">
                <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="truncate">
                  {item.icon} {item.name}
                </span>
              </div>
              <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                <span className="font-medium text-green-600">${item.amount.toFixed(2)}</span>
                <span className="text-muted-foreground w-8 md:w-10 text-right">{((item.amount / totalIncome) * 100).toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
