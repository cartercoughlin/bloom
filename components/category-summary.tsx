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

interface CategorySummaryProps {
  transactions: Transaction[]
}

export function CategorySummary({ transactions }: CategorySummaryProps) {
  // Calculate net amount (income - expense) by category
  const categoryData: Record<string, { name: string; income: number; expenses: number; net: number; color: string; icon: string | null }> = {}

  transactions.forEach((t) => {
    if (t.categories) {
      const key = t.categories.name
      if (!categoryData[key]) {
        categoryData[key] = {
          name: t.categories.name,
          income: 0,
          expenses: 0,
          net: 0,
          color: t.categories.color,
          icon: t.categories.icon,
        }
      }

      if (t.transaction_type === "credit") {
        categoryData[key].income += Number(t.amount)
      } else if (t.transaction_type === "debit") {
        categoryData[key].expenses += Number(t.amount)
      }

      categoryData[key].net = categoryData[key].income - categoryData[key].expenses
    }
  })

  const chartData = Object.values(categoryData)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net)) // Sort by absolute value of net
    .slice(0, 10) // Top 10 categories

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="text-base md:text-lg">Category Summary</CardTitle>
          <CardDescription className="text-xs md:text-sm">No categorized transactions this month</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-muted-foreground text-xs md:text-sm">Categorize transactions to see net amounts</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3 md:pb-6">
        <CardTitle className="text-base md:text-lg">Category Summary</CardTitle>
        <CardDescription className="text-xs md:text-sm">Net amounts by category (Income - Expenses)</CardDescription>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pb-4 md:pb-6">
        <div className="space-y-2">
          {chartData.map((item) => (
            <div key={item.name} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-medium text-sm">
                    {item.icon} {item.name}
                  </span>
                </div>
                <span className={`font-bold text-sm ${item.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {item.net >= 0 ? '+' : '-'}${Math.abs(item.net).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground pl-5">
                <span>Income: ${item.income.toFixed(2)}</span>
                <span>Expenses: ${item.expenses.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
