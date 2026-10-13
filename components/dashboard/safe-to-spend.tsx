"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { PrivateAmount } from "@/components/private-amount"
import { cn } from "@/lib/utils"
import type { BudgetSummary } from "@/lib/budget/summary"

// The one-glance answer to "am I on track this month?"
export function SafeToSpend({ summary }: { summary: BudgetSummary }) {
  const { totalBudget, totalSpent, remaining, safeToSpend, dailyAllowance, upcomingRecurring, expectedTotal, pacingDifference, progress } = summary

  if (totalBudget <= 0) {
    return (
      <Card className="rounded-xl">
        <CardContent className="py-8 text-center space-y-2">
          <p className="font-semibold">No budgets set for this month</p>
          <p className="text-sm text-muted-foreground">
            Set spending limits to see what's safe to spend.{" "}
            <Link href="/budgets" className="text-green-600 font-medium">Set up budgets</Link>
          </p>
        </CardContent>
      </Card>
    )
  }

  const usedFraction = totalSpent / totalBudget
  const finished = !progress.isCurrentMonth

  let headline: React.ReactNode
  let caption: string
  if (finished) {
    headline = <PrivateAmount amount={Math.abs(remaining)} decimals={0} />
    caption = remaining >= 0 ? "under budget" : "over budget"
  } else if (safeToSpend > 0 && dailyAllowance !== null) {
    headline = <><PrivateAmount amount={dailyAllowance} decimals={0} /><span className="text-xl font-semibold text-muted-foreground">/day</span></>
    caption = `safe to spend for the next ${progress.daysLeft} day${progress.daysLeft === 1 ? "" : "s"}`
  } else {
    headline = <PrivateAmount amount={Math.abs(safeToSpend)} decimals={0} />
    caption = upcomingRecurring > 0 && remaining > 0 ? "short once upcoming bills post" : "over budget"
  }

  // Same pace as the Budgets page Progress bar: spent vs. expected by today
  const status = finished || pacingDifference === null
    ? null
    : pacingDifference <= 0
      ? { tone: "good", text: <>On track · <PrivateAmount amount={-pacingDifference} decimals={0} /> ahead of pace</> }
      : { tone: "bad", text: <><PrivateAmount amount={pacingDifference} decimals={0} /> over pace</> }

  const negative = finished ? remaining < 0 : safeToSpend <= 0

  return (
    <Card className="rounded-xl">
      <CardContent className="p-5 md:p-6">
        <div className="flex items-center gap-5">
          <ProgressRing used={usedFraction} expected={expectedTotal !== null ? expectedTotal / totalBudget : null} />
          <div className="min-w-0">
            <div className={cn("text-4xl font-bold tracking-tight tabular-nums", negative ? "text-red-600" : "text-foreground")}>
              {headline}
            </div>
            <p className="text-sm text-muted-foreground">{caption}</p>
            {status && (
              <p className={cn(
                "mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                status.tone === "good" ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-red-500/10 text-red-700 dark:text-red-400"
              )}>
                {status.text}
              </p>
            )}
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
          <Stat label="Spent" amount={totalSpent} />
          <Stat label={remaining >= 0 ? "Left" : "Over"} amount={Math.abs(remaining)} tone={remaining < 0 ? "bad" : undefined} />
          {progress.isCurrentMonth && upcomingRecurring > 0
            ? <Stat label="Bills ahead" amount={upcomingRecurring} />
            : <Stat label="Budget" amount={totalBudget} />}
        </dl>
      </CardContent>
    </Card>
  )
}

function Stat({ label, amount, tone }: { label: string; amount: number; tone?: "bad" }) {
  return (
    <div className="rounded-lg bg-muted/50 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm font-semibold tabular-nums", tone === "bad" && "text-red-600")}>
        <PrivateAmount amount={amount} decimals={0} />
      </dd>
    </div>
  )
}

// Ring fills with the share of budget used; the tick marks expected spending by today
function ProgressRing({ used, expected }: { used: number; expected: number | null }) {
  const size = 88
  const stroke = 9
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.min(1, Math.max(0, used))
  const over = used > 1
  const overPace = expected !== null && used > expected
  const color = over ? "#dc2626" : overPace ? "#f59e0b" : "#16a34a"
  const tickAngle = expected !== null ? Math.min(1, expected) * 2 * Math.PI - Math.PI / 2 : null

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{ transition: "stroke-dashoffset 600ms ease-out" }}
        />
      </svg>
      {tickAngle !== null && (
        <span
          className="absolute h-3 w-0.5 rounded bg-foreground/70"
          style={{
            left: size / 2 + r * Math.cos(tickAngle) - 1,
            top: size / 2 + r * Math.sin(tickAngle) - 6,
            transform: `rotate(${tickAngle + Math.PI / 2}rad)`,
          }}
          title="Expected by today"
        />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold tabular-nums">{Math.round(used * 100)}%</span>
        <span className="text-[10px] text-muted-foreground -mt-0.5">used</span>
      </div>
    </div>
  )
}
