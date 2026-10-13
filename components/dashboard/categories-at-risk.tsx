"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PrivateAmount } from "@/components/private-amount"
import { CheckCircle2, ChevronRight } from "lucide-react"
import { categoriesAtRisk, type BudgetSummary } from "@/lib/budget/summary"

const MAX_SHOWN = 3

export function CategoriesAtRisk({ summary }: { summary: BudgetSummary }) {
  if (summary.totalBudget <= 0) return null
  const finished = !summary.progress.isCurrentMonth
  const atRisk = categoriesAtRisk(summary)

  if (atRisk.length === 0) {
    return (
      <Card className="rounded-xl">
        <CardContent className="flex items-center gap-3 p-4">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          <p className="text-sm">
            {finished ? "Every category finished within budget." : "Every category is on or ahead of pace."}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{finished ? "Went over budget" : "Categories at risk"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        {atRisk.slice(0, MAX_SHOWN).map(c => {
          const scale = Math.max(c.budget, c.spent)
          const spentPct = (c.spent / scale) * 100
          const budgetPct = (c.budget / scale) * 100
          const expectedPct = (Math.min(c.expected, scale) / scale) * 100
          const alreadyOver = c.overBy > 0

          return (
            <Link key={c.categoryId} href="/budgets" className="block group">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium truncate">
                  {c.icon} {c.name}
                </span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {alreadyOver ? (
                    <><PrivateAmount amount={c.overBy} decimals={0} className="font-semibold text-red-600" /> over budget</>
                  ) : (
                    <><PrivateAmount amount={c.pacingDifference} decimals={0} className="font-semibold text-amber-600" /> behind pace</>
                  )}
                </span>
              </div>
              <div className="relative mt-1.5">
                <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${spentPct}%`, backgroundColor: c.color }} />
                </div>
                {/* Budget limit, when spending has gone past it */}
                {alreadyOver && (
                  <div className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-foreground/60" style={{ left: `calc(${budgetPct}% - 1px)` }} />
                )}
                {/* Expected by today, same as the pace marker on Budgets */}
                {!finished && !alreadyOver && (
                  <div className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-blue-600 dark:bg-blue-400" style={{ left: `calc(${expectedPct}% - 1px)` }} title="Expected by today" />
                )}
              </div>
            </Link>
          )
        })}
        {atRisk.length > MAX_SHOWN && (
          <Link href="/budgets" className="flex items-center text-xs font-medium text-green-600">
            {atRisk.length - MAX_SHOWN} more
            <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
