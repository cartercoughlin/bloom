"use client"

import { memo, useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChevronRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { PrivateAmount } from "@/components/private-amount"
import { usePrivacy } from "@/contexts/privacy-context"
import { CACHE_KEYS } from "@/contexts/app-data-context"
import { useCachedData } from "@/hooks/use-cached-data"
import { cn } from "@/lib/utils"

interface Point {
  date: string // YYYY-MM-DD
  assets: number
  liabilities: number
  netWorth: number
  estimated: boolean
}

interface NetWorthData {
  points: Point[]
  hasAccounts: boolean
  coverageStart?: string
  investmentAccountNames: string[]
  investmentTransferCount: number
}

const RANGES = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
] as const

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
const compactCurrency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 })

const parseDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(y, m - 1, d)
}

async function fetchNetWorth(): Promise<NetWorthData> {
  const accountsRes = await fetch("/api/account-balances", { cache: "no-store" })
  const accounts = accountsRes.ok ? await accountsRes.json() : []
  if (!Array.isArray(accounts) || accounts.length === 0) {
    return { points: [], hasAccounts: false, investmentAccountNames: [], investmentTransferCount: 0 }
  }

  // History is rebuilt backwards from exactly these balances, so it ends at today's numbers
  const historyRes = await fetch("/api/net-worth-history?months=12", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accounts }),
    cache: "no-store",
  })
  const history = historyRes.ok ? await historyRes.json() : null
  return {
    points: history?.points || [],
    hasAccounts: true,
    coverageStart: history?.coverageStart,
    investmentAccountNames: history?.investmentAccountNames || [],
    investmentTransferCount: history?.investmentTransferCount || 0,
  }
}

function NetWorthChartInner({ variant = "full" }: { variant?: "card" | "full" }) {
  const { privacyMode } = usePrivacy()
  const [months, setMonths] = useState<number>(variant === "card" ? 6 : 12)
  const fetcher = useCallback(fetchNetWorth, [])
  const { data, loading } = useCachedData(`${CACHE_KEYS.netWorth}chart-v2`, fetcher)

  const points = useMemo(() => {
    if (!data) return []
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - months)
    return data.points.filter(p => parseDate(p.date) >= cutoff)
  }, [data, months])

  // One x-axis label per month, at its first data point
  const monthTicks = useMemo(
    () => points.filter((p, i) => i === 0 || p.date.slice(0, 7) !== points[i - 1].date.slice(0, 7)).map(p => p.date),
    [points]
  )

  const latest = points[points.length - 1]
  const first = points[0]
  const change = latest && first && points.length > 1 ? latest.netWorth - first.netWorth : null
  const changePct = change !== null && first.netWorth !== 0 ? (change / Math.abs(first.netWorth)) * 100 : null
  const rangeLabel = RANGES.find(r => r.months === months)?.label ?? `${months}M`

  const header = (
    <CardHeader className="pb-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base md:text-lg">Net Worth</CardTitle>
          {latest ? (
            <div className="mt-1">
              <PrivateAmount amount={latest.netWorth} decimals={0} className="text-2xl font-bold tabular-nums" />
              {change !== null && (
                <span className={cn("ml-2 text-xs font-medium", change >= 0 ? "text-green-600" : "text-red-600")}>
                  <PrivateAmount amount={change} decimals={0} showSign />
                  {changePct !== null && !privacyMode && ` (${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}%)`}
                  <span className="text-muted-foreground font-normal"> · {rangeLabel}</span>
                </span>
              )}
            </div>
          ) : (
            <CardDescription className="text-xs md:text-sm">Assets minus liabilities over time</CardDescription>
          )}
        </div>
        {variant === "card" ? (
          <Link href="/net-worth" className="flex items-center text-xs font-medium text-green-600 flex-shrink-0">
            Details <ChevronRight className="h-3 w-3" />
          </Link>
        ) : (
          <div className="flex rounded-lg bg-muted p-0.5 flex-shrink-0" role="tablist" aria-label="Time range">
            {RANGES.map(r => (
              <button
                key={r.label}
                role="tab"
                aria-selected={months === r.months}
                onClick={() => setMonths(r.months)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                  months === r.months ? "bg-background shadow-sm" : "text-muted-foreground"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </CardHeader>
  )

  if (loading && !data) {
    return (
      <Card className="rounded-xl">
        {header}
        <CardContent><Skeleton className="h-40 w-full" /></CardContent>
      </Card>
    )
  }

  if (!data?.hasAccounts) {
    return (
      <Card className="rounded-xl">
        {header}
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Connect an account to track your net worth.{" "}
          <Link href="/accounts" className="text-green-600 font-medium">Connect</Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-xl">
      {header}
      <CardContent className="px-3 pb-4 sm:px-6">
        {points.length < 2 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Not enough transaction history yet to estimate past balances.
          </p>
        ) : (
          <ChartContainer
            config={{
              netWorth: { label: "Net worth", color: "#16a34a" },
              assets: { label: "Assets", color: "#16a34a" },
              liabilities: { label: "Liabilities", color: "#dc2626" },
            }}
            className={cn("w-full aspect-auto", variant === "card" ? "h-36 sm:h-44" : "h-56 sm:h-72")}
          >
            <AreaChart data={points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-netWorth)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-netWorth)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                ticks={monthTicks}
                interval="preserveStartEnd"
                minTickGap={16}
                tickFormatter={(d) => parseDate(d).toLocaleDateString("en-US", { month: "short" })}
                className="text-[10px] md:text-xs"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={privacyMode ? 36 : 52}
                domain={["auto", "auto"]}
                tickFormatter={(v) => (privacyMode ? "••" : compactCurrency.format(Number(v)))}
                className="text-[10px] md:text-xs"
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      const p = payload?.[0]?.payload as Point | undefined
                      return p
                        ? `${parseDate(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}${p.estimated ? " (estimated)" : ""}`
                        : ""
                    }}
                    formatter={(_, __, item) => {
                      const p = item.payload as Point
                      const row = (label: string, value: number) => (
                        <div key={label} className="flex min-w-[9rem] items-center justify-between gap-4">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-mono font-medium text-foreground">{privacyMode ? "••••" : currency.format(value)}</span>
                        </div>
                      )
                      return (
                        <div className="space-y-0.5">
                          {row("Net worth", p.netWorth)}
                          {row("Assets", p.assets)}
                          {row("Liabilities", p.liabilities)}
                        </div>
                      )
                    }}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="netWorth"
                stroke="var(--color-netWorth)"
                strokeWidth={2}
                fill="url(#netWorthFill)"
                dot={false}
              />
            </AreaChart>
          </ChartContainer>
        )}
        {points.some(p => p.estimated) && data && (
          <p className="mt-2 px-1 text-[11px] leading-snug text-muted-foreground">
            Past values are estimated by working back from today's balances through your transactions.
            {data.investmentAccountNames.length > 0 && (
              <> {data.investmentAccountNames.join(", ")} only {data.investmentAccountNames.length === 1 ? "reflects" : "reflect"} deposits and withdrawals{data.investmentTransferCount > 0 ? ` (${data.investmentTransferCount} found)` : ""}, not market gains or losses.</>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export const NetWorthChart = memo(NetWorthChartInner)
