'use client'

import { useCallback, useMemo, useState } from "react"
import { AlertTriangle, Ban, Check, ChevronDown, Loader2, Pencil, Repeat, RotateCcw, TrendingDown, TrendingUp, XCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PrivateAmount } from "@/components/private-amount"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { useCachedData } from "@/hooks/use-cached-data"
import { cn } from "@/lib/utils"
import {
  CADENCES,
  daysUntil,
  fetchSubscriptions,
  MIGRATION_HINT,
  SUBSCRIPTIONS_CACHE_KEY,
  summarizeSubscriptions,
  type SubscriptionStatus,
  type SubscriptionView,
} from "@/lib/subscriptions"

type Filter = "tracked" | "review" | "cancelled" | "ignored"

const FILTERS: { value: Filter; label: string }[] = [
  { value: "tracked", label: "Tracked" },
  { value: "review", label: "To review" },
  { value: "cancelled", label: "Cancelled" },
  { value: "ignored", label: "Not subscriptions" },
]

const shortDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number)
  const sameYear = y === new Date().getFullYear()
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) })
}

const relativeDay = (date: string) => {
  const days = daysUntil(date)
  if (days === 0) return "today"
  if (days === 1) return "tomorrow"
  if (days > 1 && days <= 6) return `in ${days} days`
  return shortDate(date)
}

// Same stream across optimistic updates, before and after it gets an id
const sameSub = (a: SubscriptionView, b: SubscriptionView) =>
  a.id && b.id ? a.id === b.id : a.merchantKey === b.merchantKey && a.cadence === b.cadence && a.amount === b.amount

export default function SubscriptionsPage() {
  const { data, loading, refreshing, refresh, mutate } = useCachedData(SUBSCRIPTIONS_CACHE_KEY, fetchSubscriptions)
  const [filter, setFilter] = useState<Filter | null>(null)
  const [renaming, setRenaming] = useState<SubscriptionView | null>(null)

  const subscriptions = data?.subscriptions || []
  const summary = useMemo(() => summarizeSubscriptions(subscriptions), [subscriptions])
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { tracked: 0, review: 0, cancelled: 0, ignored: 0 }
    for (const s of subscriptions) c[s.status]++
    return c
  }, [subscriptions])

  // Start on review until something is tracked
  const activeFilter: Filter = filter ?? (counts.tracked === 0 && counts.review > 0 ? "review" : "tracked")

  const visible = useMemo(() => {
    const list = subscriptions.filter(s => s.status === activeFilter)
    if (activeFilter === "tracked") {
      // Soonest charge first; lapsed ones (no next date) last
      return list.sort((a, b) => (a.nextDate || "9999").localeCompare(b.nextDate || "9999"))
    }
    if (activeFilter === "review") return list.sort((a, b) => b.monthlyCost - a.monthlyCost)
    return list.sort((a, b) => (b.lastDate || "").localeCompare(a.lastDate || ""))
  }, [subscriptions, activeFilter])

  const replace = useCallback((target: SubscriptionView, next: SubscriptionView | null) => {
    mutate(prev => ({
      ...prev,
      subscriptions: next
        ? prev.subscriptions.map(s => (sameSub(s, target) ? next : s))
        : prev.subscriptions.filter(s => !sameSub(s, target)),
    }))
  }, [mutate])

  const setStatus = useCallback(async (sub: SubscriptionView, status: SubscriptionStatus | "review") => {
    const optimistic: SubscriptionView = {
      ...sub,
      status,
      nextDate: status === "cancelled" ? null : sub.nextDate,
      chargedAfterCancel: false,
    }
    // A forgotten decision on a lapsed charge disappears; detection only lists active ones
    replace(sub, status === "review" && !sub.active ? null : optimistic)

    try {
      let res: Response
      if (status === "review") {
        res = await fetch(`/api/subscriptions/${sub.id}`, { method: "DELETE" })
      } else if (sub.id) {
        res = await fetch(`/api/subscriptions/${sub.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        })
      } else {
        res = await fetch("/api/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ merchant_key: sub.merchantKey, amount: sub.amount, cadence: sub.cadence, status }),
        })
      }
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Couldn't update subscription")
      if (status === "review") {
        replace(optimistic, sub.active ? { ...optimistic, id: null, name: sub.detectedName } : null)
      } else {
        replace(optimistic, { ...optimistic, id: json.id, nextDate: status === "cancelled" ? null : sub.nextDate })
      }
      const messages: Record<string, string> = {
        tracked: `Tracking ${sub.name}`,
        cancelled: `Marked ${sub.name} as cancelled`,
        ignored: `${sub.name} won't be suggested again`,
        review: `${sub.name} moved back to review`,
      }
      toast.success(messages[status])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update subscription")
      refresh()
    }
  }, [replace, refresh])

  if (loading && !data) {
    return (
      <div className="container mx-auto p-3 md:p-6 max-w-3xl pb-20 md:pb-6 space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-28 w-full" />
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    )
  }

  return (
    <div className="container mx-auto p-3 md:p-6 max-w-3xl pb-20 md:pb-6">
      <PullToRefresh onRefresh={refresh} />
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-3xl font-bold mb-1 text-green-600 flex items-center gap-2">
          Subscriptions
          {refreshing && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </h1>
        <p className="text-muted-foreground text-xs md:text-sm">
          Recurring charges found in your transactions. Track the real ones and dismiss the rest.
        </p>
      </div>

      {data?.needsMigration && (
        <Card className="rounded-xl mb-4 py-0">
          <CardContent className="p-4 text-sm text-muted-foreground">{MIGRATION_HINT} to track or dismiss subscriptions.</CardContent>
        </Card>
      )}

      <Card className="rounded-xl mb-4 py-0">
        <CardContent className="p-4 md:p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Tracked subscriptions</p>
              <p className="text-2xl md:text-3xl font-bold tabular-nums">
                <PrivateAmount amount={summary.monthly} decimals={2} />
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <p className="text-xs text-muted-foreground">
                <PrivateAmount amount={summary.yearly} decimals={0} /> a year · {summary.tracked.length} subscription{summary.tracked.length === 1 ? "" : "s"}
              </p>
            </div>
            {summary.upcoming.length > 0 && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Next 7 days</p>
                <p className="text-lg font-semibold tabular-nums">
                  <PrivateAmount amount={summary.upcoming.reduce((sum, s) => sum + s.amount, 0)} decimals={2} />
                </p>
                <p className="text-xs text-muted-foreground">{summary.upcoming.length} charge{summary.upcoming.length === 1 ? "" : "s"}</p>
              </div>
            )}
          </div>

          {summary.alerts.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t pt-3">
              {summary.alerts.map(sub => (
                <li key={`${sub.id}-${sub.merchantKey}`} className="flex items-start gap-2 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span>
                    <span className="font-medium">{sub.name}</span>{" "}
                    {sub.chargedAfterCancel ? (
                      <>charged <PrivateAmount amount={sub.amount} /> on {shortDate(sub.lastDate!)} after you cancelled</>
                    ) : !sub.active ? (
                      sub.lastDate ? <>hasn&apos;t charged since {shortDate(sub.lastDate)}. Cancelled?</> : <>has no recent charges. Cancelled?</>
                    ) : (
                      <>went up from <PrivateAmount amount={sub.priceChange!.from} /> to <PrivateAmount amount={sub.priceChange!.to} /> on {shortDate(sub.priceChange!.since)}</>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 -mx-1 px-1" role="tablist">
        {FILTERS.map(f => (
          <button
            key={f.value}
            role="tab"
            aria-selected={activeFilter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "flex-shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              activeFilter === f.value ? "bg-foreground text-background border-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {f.label}
            {counts[f.value] > 0 && <span className="ml-1 opacity-70">{counts[f.value]}</span>}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card className="rounded-xl">
          <CardContent className="py-10 text-center space-y-2">
            <Repeat className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="font-medium">{EMPTY_TITLES[activeFilter]}</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">{EMPTY_HINTS[activeFilter]}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-xl overflow-hidden py-0">
          <ul className="divide-y">
            {visible.map(sub => (
              <SubscriptionRow
                key={`${sub.id}-${sub.merchantKey}-${sub.amount}`}
                sub={sub}
                disabled={!!data?.needsMigration}
                onStatus={(status) => setStatus(sub, status)}
                onRename={() => setRenaming(sub)}
              />
            ))}
          </ul>
        </Card>
      )}

      <p className="mt-4 text-[11px] text-muted-foreground">
        Found from charges at the same merchant, for a similar amount, on a regular schedule over the last two years.
        Monthly totals convert yearly and weekly plans to a monthly cost.
      </p>

      <RenameDialog
        sub={renaming}
        onClose={() => setRenaming(null)}
        onSaved={(updated) => { replace(renaming!, updated); setRenaming(null) }}
      />
    </div>
  )
}

const EMPTY_TITLES: Record<Filter, string> = {
  tracked: "Nothing tracked yet",
  review: "Nothing new to review",
  cancelled: "No cancelled subscriptions",
  ignored: "Nothing dismissed",
}

const EMPTY_HINTS: Record<Filter, string> = {
  tracked: "Track subscriptions from To review to see what they cost each month and when they renew.",
  review: "New recurring charges show up here as they're detected, usually after the third monthly charge.",
  cancelled: "Mark a subscription cancelled once you've stopped it, and we'll flag it if it charges again.",
  ignored: "Charges you mark as not a subscription stay here so they aren't suggested again.",
}

function Avatar({ sub }: { sub: SubscriptionView }) {
  const [failed, setFailed] = useState(false)
  if (sub.logoUrl && !failed) {
    return <img src={sub.logoUrl} alt="" loading="lazy" onError={() => setFailed(true)} className="h-9 w-9 rounded-full object-cover flex-shrink-0 bg-muted" />
  }
  return (
    <div aria-hidden className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 font-semibold bg-violet-500/15 text-violet-600">
      {sub.name.trim().charAt(0).toUpperCase()}
    </div>
  )
}

function SubscriptionRow({
  sub,
  disabled,
  onStatus,
  onRename,
}: {
  sub: SubscriptionView
  disabled: boolean
  onStatus: (status: SubscriptionStatus | "review") => void
  onRename: () => void
}) {
  const [open, setOpen] = useState(false)
  const spec = CADENCES[sub.cadence]

  let subtitle: string
  if (sub.status === "cancelled") subtitle = sub.lastDate ? `Last charged ${shortDate(sub.lastDate)}` : "Cancelled"
  else if (sub.nextDate) subtitle = `${spec.label} · next ${relativeDay(sub.nextDate)}`
  else if (sub.lastDate) subtitle = `${spec.label} · last charged ${shortDate(sub.lastDate)}`
  else subtitle = `${spec.label} · no recent charges`

  return (
    <li>
      <button className="w-full flex items-center gap-3 p-3 md:p-4 text-left hover:bg-muted/40 active:bg-muted" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <Avatar sub={sub} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium truncate">{sub.name}</span>
            {sub.priceChange && sub.status !== "ignored" && (
              sub.priceChange.to > sub.priceChange.from
                ? <TrendingUp className="h-3.5 w-3.5 text-red-600 flex-shrink-0" aria-label="Price went up" />
                : <TrendingDown className="h-3.5 w-3.5 text-green-600 flex-shrink-0" aria-label="Price went down" />
            )}
            {(sub.chargedAfterCancel || (sub.status === "tracked" && !sub.active)) && (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" aria-label="Needs a look" />
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={cn("font-semibold tabular-nums", sub.status !== "tracked" && sub.status !== "review" && "text-muted-foreground")}>
            <PrivateAmount amount={sub.amount} />
            <span className="text-[11px] font-normal text-muted-foreground">/{spec.short}</span>
          </p>
          {sub.cadence !== "monthly" && (
            <p className="text-[11px] text-muted-foreground"><PrivateAmount amount={sub.monthlyCost} />/mo</p>
          )}
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="px-3 md:px-4 pb-3 md:pb-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {sub.status === "review" && (
              <>
                <Button size="sm" className="h-8" disabled={disabled} onClick={() => onStatus("tracked")}><Check className="mr-1 h-3.5 w-3.5" />Track</Button>
                <Button size="sm" variant="outline" className="h-8" disabled={disabled} onClick={() => onStatus("ignored")}><XCircle className="mr-1 h-3.5 w-3.5" />Not a subscription</Button>
              </>
            )}
            {sub.status === "tracked" && (
              <>
                <Button size="sm" variant="outline" className="h-8" onClick={onRename}><Pencil className="mr-1 h-3.5 w-3.5" />Rename</Button>
                <Button size="sm" variant="outline" className="h-8" onClick={() => onStatus("cancelled")}><Ban className="mr-1 h-3.5 w-3.5" />I cancelled it</Button>
                <Button size="sm" variant="outline" className="h-8" onClick={() => onStatus("ignored")}><XCircle className="mr-1 h-3.5 w-3.5" />Not a subscription</Button>
              </>
            )}
            {sub.status === "cancelled" && (
              <>
                <Button size="sm" variant="outline" className="h-8" onClick={() => onStatus("tracked")}><RotateCcw className="mr-1 h-3.5 w-3.5" />Track again</Button>
                <Button size="sm" variant="outline" className="h-8" onClick={() => onStatus("ignored")}><XCircle className="mr-1 h-3.5 w-3.5" />Not a subscription</Button>
              </>
            )}
            {sub.status === "ignored" && (
              <>
                <Button size="sm" variant="outline" className="h-8" onClick={() => onStatus("tracked")}><Check className="mr-1 h-3.5 w-3.5" />Track</Button>
                <Button size="sm" variant="outline" className="h-8" onClick={() => onStatus("review")}><RotateCcw className="mr-1 h-3.5 w-3.5" />Undo</Button>
              </>
            )}
          </div>

          {sub.charges.length > 0 ? (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground mb-1">
                Charges{sub.status === "review" && ` · ${Math.round(sub.confidence * 100)}% match`}
              </p>
              <ul className="text-xs divide-y rounded-lg border">
                {sub.charges.slice(0, 12).map(charge => (
                  <li key={charge.id} className="flex justify-between px-3 py-1.5">
                    <span className="text-muted-foreground">{shortDate(charge.date)}</span>
                    <PrivateAmount amount={charge.amount} className="tabular-nums" />
                  </li>
                ))}
              </ul>
              {sub.charges.length > 12 && (
                <p className="mt-1 text-[11px] text-muted-foreground">and {sub.charges.length - 12} earlier</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No charges in the last two years.</p>
          )}
        </div>
      )}
    </li>
  )
}

function RenameDialog({ sub, onClose, onSaved }: { sub: SubscriptionView | null; onClose: () => void; onSaved: (sub: SubscriptionView) => void }) {
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [openFor, setOpenFor] = useState<string | null>(null)

  // Reset the field each time the dialog opens for a different subscription
  const key = sub?.id || null
  if (key !== openFor) {
    setOpenFor(key)
    setName(sub?.name || "")
  }

  const save = async () => {
    if (!sub?.id || saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Couldn't rename subscription")
      onSaved({ ...sub, name: json.name || sub.detectedName })
      toast.success("Renamed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't rename subscription")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={sub !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename subscription</DialogTitle>
          <DialogDescription>Shows as {sub?.detectedName} on your statements. Leave blank to use that name.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save() }}>
          <div className="space-y-2">
            <Label htmlFor="sub-name">Name</Label>
            <Input id="sub-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={sub?.detectedName} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
