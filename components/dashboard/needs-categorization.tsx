"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { PrivateAmount } from "@/components/private-amount"
import { ChevronRight, Tags } from "lucide-react"

// The month's uncategorized transactions aren't counted in any budget, so nudge the user to sort them
export function NeedsCategorization({ count, amountThisMonth, monthLabel }: { count: number; amountThisMonth: number; monthLabel: string }) {
  if (count === 0) return null

  return (
    <Link href="/transactions" className="block">
      <Card className="rounded-xl transition-colors hover:bg-muted/50 active:bg-muted">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
            <Tags className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {count} transaction{count === 1 ? "" : "s"} {monthLabel} need{count === 1 ? "s" : ""} a category
            </p>
            {amountThisMonth > 0 && (
              <p className="text-xs text-muted-foreground">
                <PrivateAmount amount={amountThisMonth} decimals={0} /> isn't counted in your budgets yet
              </p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </CardContent>
      </Card>
    </Link>
  )
}
