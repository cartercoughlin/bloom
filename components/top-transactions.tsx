"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PrivateAmount } from "./private-amount"

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  transaction_type: string
  categories: {
    name: string
    color: string
    icon: string | null
  } | null
}

interface TopTransactionsProps {
  transactions: Transaction[]
}

export function TopTransactions({ transactions }: TopTransactionsProps) {
  const topExpenses = transactions
    .filter((t) => t.transaction_type === "debit")
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 10)

  if (topExpenses.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="text-base md:text-lg">Top Expenses</CardTitle>
          <CardDescription className="text-xs md:text-sm">Your largest transactions this month</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48 md:h-64">
          <p className="text-muted-foreground text-xs md:text-sm">No expenses recorded this month</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3 md:pb-6">
        <CardTitle className="text-base md:text-lg">Top Expenses</CardTitle>
        <CardDescription className="text-xs md:text-sm">Your largest transactions this month</CardDescription>
      </CardHeader>
      <CardContent className="pb-4 md:pb-6">
        <div className="space-y-2 md:space-y-3">
          {topExpenses.map((tx, index) => (
            <div key={tx.id} className="flex items-center justify-between py-1.5 md:py-2 border-b last:border-0">
              <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                <div className="flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full bg-muted text-[10px] md:text-xs font-medium">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-xs md:text-sm">{tx.description}</p>
                  <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs text-muted-foreground">
                    <span>{new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    {tx.categories && (
                      <>
                        <span>•</span>
                        <span style={{ color: tx.categories.color }} className="truncate">
                          {tx.categories.icon} {tx.categories.name}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right ml-2">
                <PrivateAmount amount={Number(tx.amount)} className="font-semibold text-red-600 text-xs md:text-sm whitespace-nowrap" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
