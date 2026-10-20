import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchAllRows } from "@/lib/supabase/fetch-all"
import {
  buildSubscriptionViews,
  CADENCES,
  detectStreams,
  isMissingSubscriptionsTable,
  LOOKBACK_DAYS,
  MIGRATION_HINT,
  type SubscriptionDecision,
  type SubscriptionTransaction,
} from "@/lib/subscriptions"

const STATUSES = ["tracked", "cancelled", "ignored"]
const MAX_NAME_LENGTH = 60

// GET /api/subscriptions: recurring charges detected from the last two years
// of transactions, merged with the user's decisions about them
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const [transactions, decisionsResult] = await Promise.all([
      fetchAllRows<SubscriptionTransaction>((from, to) =>
        supabase
          .from("transactions")
          // `*` so plaid_details and personal_finance_category are used once their migrations have run
          .select("*")
          .eq("user_id", user.id)
          .gte("date", since)
          .not("deleted", "is", true)
          .order("date")
          .order("id")
          .range(from, to)
      ),
      supabase
        .from("subscriptions")
        .select("id, merchant_key, name, status, amount, cadence, cancelled_at, created_at")
        .eq("user_id", user.id)
        .order("created_at"),
    ])

    let needsMigration = false
    let decisions: SubscriptionDecision[] = []
    if (decisionsResult.error) {
      if (!isMissingSubscriptionsTable(decisionsResult.error)) throw decisionsResult.error
      needsMigration = true
    } else {
      decisions = (decisionsResult.data || []) as SubscriptionDecision[]
    }

    const subscriptions = buildSubscriptionViews(detectStreams(transactions), decisions)
    return NextResponse.json({ subscriptions, needsMigration })
  } catch (error) {
    console.error("Subscriptions GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/subscriptions { merchant_key, amount, cadence, status, name? }
// records a decision about a detected subscription
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const merchantKey = typeof body.merchant_key === "string" ? body.merchant_key.trim() : ""
    const amount = Number(body.amount)
    if (!merchantKey) return NextResponse.json({ error: "merchant_key is required" }, { status: 400 })
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "amount must be positive" }, { status: 400 })
    if (typeof body.cadence !== "string" || !Object.hasOwn(CADENCES, body.cadence)) return NextResponse.json({ error: "Unknown cadence" }, { status: 400 })
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: "Unknown status" }, { status: 400 })
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, MAX_NAME_LENGTH) : null

    const { data, error } = await supabase
      .from("subscriptions")
      .insert({
        user_id: user.id,
        merchant_key: merchantKey,
        name,
        status: body.status,
        amount,
        cadence: body.cadence,
        cancelled_at: body.status === "cancelled" ? new Date().toISOString().slice(0, 10) : null,
      })
      .select("id, merchant_key, name, status, amount, cadence, cancelled_at, created_at")
      .single()
    if (error) {
      if (isMissingSubscriptionsTable(error)) return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
      throw error
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error("Subscriptions POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
