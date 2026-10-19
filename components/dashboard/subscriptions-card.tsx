"use client"

import Link from "next/link"
import { ChevronRight, Repeat } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { PrivateAmount } from "@/components/private-amount"
import { useCachedData } from "@/hooks/use-cached-data"
import { fetchSubscriptions, SUBSCRIPTIONS_CACHE_KEY, summarizeSubscriptions } from "@/lib/subscriptions"

// Monthly subscription cost, plus anything that needs attention
export function SubscriptionsCard() {
  const { data } = useCachedData(SUBSCRIPTIONS_CACHE_KEY, fetchSubscriptions)
  if (!data) return null

  const summary = summarizeSubscriptions(data.subscriptions)
  if (summary.tracked.length === 0 && summary.reviewCount === 0) return null

  const notes = [
    summary.upcoming.length > 0 && `${summary.upcoming.length} charge${summary.upcoming.length === 1 ? "" : "s"} this week`,
    summary.alerts.length > 0 && `${summary.alerts.length} to check`,
    summary.reviewCount > 0 && `${summary.reviewCount} new to review`,
  ].filter(Boolean)

  return (
    <Link href="/subscriptions" className="block">
      <Card className="rounded-xl transition-colors hover:bg-muted/50 active:bg-muted">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-600">
            <Repeat className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {summary.tracked.length > 0 ? (
                <>Subscriptions: <PrivateAmount amount={summary.monthly} decimals={0} />/mo</>
              ) : (
                "We found recurring charges"
              )}
            </p>
            {notes.length > 0 && <p className="text-xs text-muted-foreground">{notes.join(" · ")}</p>}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </CardContent>
      </Card>
    </Link>
  )
}
