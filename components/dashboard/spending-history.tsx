"use client"

import { memo } from "react"
import { Bar, CartesianGrid, Cell, ComposedChart, Line, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { PrivateAmount } from "@/components/private-amount"
import { usePrivacy } from "@/contexts/privacy-context"
import type { MonthHistory } from "@/lib/budget/history"

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
const compactCurrency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 })

function SpendingHistoryInner({ history }: { history: MonthHistory[] }) {
  const { privacyMode } = usePrivacy()
  const complete = history.filter(m => !m.isPartial && (m.spent > 0 || m.budget))
  const average = complete.length > 0 ? complete.reduce((s, m) => s + m.spent, 0) / complete.length : null
  const budgeted = complete.filter(m => m.budget !== null)
  const underCount = budgeted.filter(m => m.spent <= (m.budget || 0)).length

  if (history.every(m => m.spent === 0 && m.budget === null)) {
    return (
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg">Last {history.length} Months</CardTitle>
        </CardHeader>
        <CardContent className="flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground">No spending history yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base md:text-lg">Last {history.length} Months</CardTitle>
        <CardDescription className="text-xs md:text-sm">Budgeted spending each month vs. that month's budget</CardDescription>
      </CardHeader>
      <CardContent className="px-3 pb-4 sm:px-6">
        <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="text-xs text-muted-foreground">Monthly average</div>
            {average !== null
              ? <PrivateAmount amount={average} decimals={0} className="font-semibold" />
              : <span className="text-muted-foreground">—</span>}
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="text-xs text-muted-foreground">Within budget</div>
            <span className="font-semibold">
              {budgeted.length > 0 ? `${underCount} of ${budgeted.length} months` : "—"}
            </span>
          </div>
        </div>

        <ChartContainer
          config={{
            spent: { label: "Spent", color: "#16a34a" },
            budget: { label: "Budget", color: "#64748b" },
          }}
          className="h-48 sm:h-56 w-full aspect-auto"
        >
          <ComposedChart data={history} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} className="text-[10px] md:text-xs" />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={privacyMode ? 36 : 48}
              tickFormatter={(v) => (privacyMode ? "••" : compactCurrency.format(Number(v)))}
              className="text-[10px] md:text-xs"
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const m = payload?.[0]?.payload as MonthHistory | undefined
                    return m ? `${new Date(m.year, m.month - 1).toLocaleString("en-US", { month: "long", year: "numeric" })}${m.isPartial ? " (so far)" : ""}` : ""
                  }}
                  formatter={(value, name) => (
                    <div className="flex min-w-[8rem] items-center justify-between gap-4">
                      <span className="text-muted-foreground">{name === "spent" ? "Spent" : "Budget"}</span>
                      <span className="font-mono font-medium text-foreground">
                        {privacyMode ? "••••" : currency.format(Number(value))}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="spent" radius={[4, 4, 0, 0]} maxBarSize={36}>
              {history.map(m => (
                <Cell
                  key={m.key}
                  fill={m.budget !== null && m.spent > m.budget ? "#dc2626" : "#16a34a"}
                  fillOpacity={m.isPartial ? 0.45 : 0.9}
                />
              ))}
            </Bar>
            <Line
              type="step"
              dataKey="budget"
              stroke="var(--color-budget)"
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              connectNulls={false}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export const SpendingHistory = memo(SpendingHistoryInner)
