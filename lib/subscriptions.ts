// Subscriptions: recurring charges detected from transaction history.
//
// Detection runs on every read (see app/api/subscriptions/route.ts), so new
// charges show up without a sync step. The subscriptions table only stores
// the user's decisions about a detected stream: track it, mark it cancelled,
// or dismiss it as not a subscription.

export type Cadence = "weekly" | "biweekly" | "monthly" | "quarterly" | "semiannual" | "annual"
export type SubscriptionStatus = "tracked" | "cancelled" | "ignored"

export interface SubscriptionTransaction {
  id: string
  date: string
  amount: number
  transaction_type: string
  description: string
  merchant_name?: string | null
  logo_url?: string | null
  personal_finance_category?: string | null
  recurring?: boolean | null
  hidden?: boolean | null
  deleted?: boolean | null
  plaid_details?: {
    payment_channel?: string | null
    category_detailed?: string | null
    counterparties?: { name: string; logo_url?: string | null }[]
  } | null
}

export interface Charge {
  id: string
  date: string
  amount: number
}

// One recurring charge pattern: a merchant billing a similar amount on a schedule
export interface DetectedStream {
  merchantKey: string
  name: string
  logoUrl: string | null
  cadence: Cadence
  averageAmount: number
  lastAmount: number
  // Latest price differs from the one before it, changed recently
  priceChange: { from: number; to: number; since: string } | null
  lastDate: string
  nextDate: string
  charges: Charge[] // newest first
  confidence: number // 0-1
  active: boolean // charged recently enough for its cadence
}

export interface SubscriptionDecision {
  id: string
  merchant_key: string
  name: string | null
  status: SubscriptionStatus
  amount: number
  cadence: Cadence
  cancelled_at: string | null
  created_at?: string
}

export interface SubscriptionView {
  // Decision id; null while the stream is waiting for review
  id: string | null
  merchantKey: string
  name: string
  detectedName: string
  logoUrl: string | null
  status: SubscriptionStatus | "review"
  cadence: Cadence
  amount: number // latest charge, or the stored amount when nothing matched
  monthlyCost: number
  lastDate: string | null
  nextDate: string | null
  charges: Charge[]
  confidence: number
  active: boolean
  priceChange: { from: number; to: number; since: string } | null
  chargedAfterCancel: boolean
}

export const MIGRATION_HINT = "Subscriptions need a database update: run migrations/add-subscriptions.sql in Supabase"

export function isMissingSubscriptionsTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return error.code === "42P01" || error.code === "PGRST205" || /relation .*subscriptions|subscriptions.*(does not exist|schema cache)/i.test(error.message || "")
}

// How far back to look; two years so annual plans have two charges to compare
export const LOOKBACK_DAYS = 760

interface CadenceSpec {
  days: number
  tolerance: number // allowed drift per interval, in days
  minCharges: number
  label: string
  short: string
}

export const CADENCES: Record<Cadence, CadenceSpec> = {
  weekly: { days: 7, tolerance: 1, minCharges: 4, label: "Weekly", short: "wk" },
  biweekly: { days: 14, tolerance: 2, minCharges: 3, label: "Every 2 weeks", short: "2 wk" },
  monthly: { days: 30.44, tolerance: 4, minCharges: 3, label: "Monthly", short: "mo" },
  quarterly: { days: 91.3, tolerance: 8, minCharges: 2, label: "Quarterly", short: "qtr" },
  semiannual: { days: 182.6, tolerance: 12, minCharges: 2, label: "Every 6 months", short: "6 mo" },
  annual: { days: 365.25, tolerance: 15, minCharges: 2, label: "Yearly", short: "yr" },
}

const DAY_MS = 24 * 60 * 60 * 1000
// Charges within this fraction of a stream's typical amount belong to it;
// wide enough to follow a price increase, narrow enough to split two plans
// billed by the same merchant (e.g. iCloud and Apple Music)
const AMOUNT_TOLERANCE = 0.2
const MIN_CONFIDENCE = 0.6

// Transfers, loan and card payments, and income recur but aren't subscriptions
const EXCLUDED_CATEGORIES = new Set(["TRANSFER_IN", "TRANSFER_OUT", "LOAN_PAYMENTS", "INCOME", "BANK_FEES"])
// Categories where regular spending is usually habit, not a subscription
const HABIT_CATEGORIES = new Set(["FOOD_AND_DRINK", "TRANSPORTATION", "TRAVEL", "GENERAL_MERCHANDISE"])
// Categories where subscriptions are common
const SUBSCRIPTION_CATEGORIES = new Set(["ENTERTAINMENT", "GENERAL_SERVICES", "RENT_AND_UTILITIES", "PERSONAL_CARE", "MEDICAL"])
// Generic descriptions that would lump unrelated charges together
const GENERIC_KEYS = new Set(["", "payment", "purchase", "debit", "pos", "ach", "withdrawal", "check", "transfer", "online payment"])

const toDay = (date: string) => {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number)
  return Date.UTC(y, m - 1, d) / DAY_MS
}
const fromDay = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10)
const round2 = (n: number) => Math.round(n * 100) / 100
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function merchantName(tx: SubscriptionTransaction): string {
  return tx.merchant_name || tx.plaid_details?.counterparties?.[0]?.name || tx.description
}

// Raw bank descriptions ("AMAZON PRIME*8J1") read better as the cleaned key
function displayMerchantName(tx: SubscriptionTransaction, key: string): string {
  const name = tx.merchant_name || tx.plaid_details?.counterparties?.[0]?.name
  return name || key.replace(/\b\w/g, c => c.toUpperCase())
}

// "SQ *BLUE BOTTLE 0423 OAKLAND CA" and "Blue Bottle" should match. Card
// processors add prefixes, store numbers and reference codes to descriptions.
export function merchantKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(sq|tst|sp|pp|paypal|py|dd|ck|apl|goog|google|amzn mktp us|in)\s*\*\s*/, "")
    .replace(/\*.*$/, "")
    .replace(/\b(www\.|\.com|\.net|\.io|\.co)\b/g, " ")
    .replace(/https?:\/\//g, "")
    .replace(/[#\d]+/g, " ")
    .replace(/\b(inc|llc|ltd|corp|co|subscription|recurring|payment|purchase|pos|debit|ach|online|bill|autopay)\b/g, " ")
    .replace(/[^a-z&+ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(\S{3,}) [a-z]{2}$/, "$1") // trailing state code, e.g. "oakland ca"
}

function cadenceFor(intervalDays: number): Cadence | null {
  for (const [cadence, spec] of Object.entries(CADENCES) as [Cadence, CadenceSpec][]) {
    // Allow a little more slack on the median than per interval
    if (Math.abs(intervalDays - spec.days) <= spec.tolerance * 1.5) return cadence
  }
  return null
}

export function nextChargeDate(lastDate: string, cadence: Cadence): string {
  if (cadence === "weekly" || cadence === "biweekly") return fromDay(toDay(lastDate) + CADENCES[cadence].days)
  // Calendar months, so a charge on the 15th is expected on the 15th
  const months = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 }[cadence]
  const [y, m, d] = lastDate.slice(0, 10).split("-").map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const daysInMonth = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, daysInMonth))
  return target.toISOString().slice(0, 10)
}

export function monthlyCost(amount: number, cadence: Cadence): number {
  return round2(amount * (CADENCES.monthly.days / CADENCES[cadence].days))
}

// Split a merchant's charges into clusters of similar amounts. Walking in
// date order lets a cluster follow gradual price increases.
function clusterByAmount(charges: Charge[]): Charge[][] {
  const clusters: { charges: Charge[]; typical: number }[] = []
  for (const charge of charges) {
    let best: (typeof clusters)[number] | null = null
    for (const cluster of clusters) {
      const diff = Math.abs(charge.amount - cluster.typical) / cluster.typical
      if (diff <= AMOUNT_TOLERANCE && (!best || diff < Math.abs(charge.amount - best.typical) / best.typical)) best = cluster
    }
    if (best) {
      best.charges.push(charge)
      best.typical = charge.amount // follow the latest price
    } else {
      clusters.push({ charges: [charge], typical: charge.amount })
    }
  }
  return clusters.map(c => c.charges)
}

function analyzeStream(
  key: string,
  charges: Charge[], // oldest first, one per day
  txById: Map<string, SubscriptionTransaction>,
  today: number
): DetectedStream | null {
  if (charges.length < 2) return null
  const days = charges.map(c => toDay(c.date))
  const intervals = days.slice(1).map((d, i) => d - days[i])
  const cadence = cadenceFor(median(intervals))
  if (!cadence) return null
  const spec = CADENCES[cadence]
  if (charges.length < spec.minCharges) return null

  // Share of gaps that land on schedule. A gap of two periods (a skipped or
  // missing charge) counts as half, so one gap doesn't sink a real subscription.
  const regularity = intervals.reduce((score, gap) => {
    if (Math.abs(gap - spec.days) <= spec.tolerance) return score + 1
    if (Math.abs(gap - spec.days * 2) <= spec.tolerance * 2) return score + 0.5
    return score
  }, 0) / intervals.length

  const amounts = charges.map(c => c.amount)
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length
  const stdev = Math.sqrt(amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length)
  // Ignore a single price change when judging stability
  const recent = amounts.slice(-Math.min(amounts.length, 3))
  const recentSpread = (Math.max(...recent) - Math.min(...recent)) / mean
  const stability = Math.max(1 - (stdev / mean) / 0.15, recentSpread < 0.01 ? 1 : 0, 0)

  const occurrence = Math.min(1, (charges.length - 1) / Math.max(spec.minCharges, 4))

  const txs = charges.map(c => txById.get(c.id)!)
  const categories = txs.map(tx => tx.personal_finance_category).filter(Boolean) as string[]
  let signals = 0
  if (txs.some(tx => tx.recurring)) signals += 0.15
  if (categories.some(c => SUBSCRIPTION_CATEGORIES.has(c))) signals += 0.1
  if (txs.filter(tx => tx.plaid_details?.payment_channel === "online").length > txs.length / 2) signals += 0.05
  if (categories.some(c => HABIT_CATEGORIES.has(c))) signals -= 0.2
  // Weekly charges are usually habits (coffee, lunch) unless the amount never moves
  if (cadence === "weekly" && recentSpread >= 0.01) signals -= 0.2

  const confidence = Math.max(0, Math.min(1, regularity * 0.45 + stability * 0.3 + occurrence * 0.15 + 0.1 + signals))

  const last = charges[charges.length - 1]
  // Most recent price change, if the new price started within the last ~6 months
  let priceChange: DetectedStream["priceChange"] = null
  for (let i = charges.length - 2; i >= 0; i--) {
    if (Math.abs(charges[i].amount - last.amount) < 0.01) continue
    const since = charges[i + 1]
    if (today - toDay(since.date) <= Math.max(183, spec.days + spec.tolerance)) {
      priceChange = { from: charges[i].amount, to: last.amount, since: since.date }
    }
    break
  }
  const latestTx = txById.get(last.id)!
  const logo = txs.map(tx => tx.logo_url || tx.plaid_details?.counterparties?.find(c => c.logo_url)?.logo_url).find(Boolean) || null

  return {
    merchantKey: key,
    name: displayMerchantName(latestTx, key),
    logoUrl: logo,
    cadence,
    averageAmount: round2(mean),
    lastAmount: last.amount,
    priceChange,
    lastDate: last.date,
    nextDate: nextChargeDate(last.date, cadence),
    charges: [...charges].reverse(),
    confidence: round2(confidence),
    // Late by more than half a period plus slack: probably cancelled
    active: today - days[days.length - 1] <= spec.days * 1.5 + spec.tolerance,
  }
}

export function detectStreams(transactions: SubscriptionTransaction[], todayDate = new Date()): DetectedStream[] {
  const today = Date.UTC(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate()) / DAY_MS
  const txById = new Map<string, SubscriptionTransaction>()
  const byMerchant = new Map<string, Charge[]>()

  for (const tx of transactions) {
    if (tx.deleted || tx.transaction_type === "credit") continue
    if (tx.personal_finance_category && EXCLUDED_CATEGORIES.has(tx.personal_finance_category)) continue
    const amount = Math.abs(Number(tx.amount))
    if (!amount) continue
    const key = merchantKey(merchantName(tx))
    if (GENERIC_KEYS.has(key) || key.length < 2) continue
    txById.set(tx.id, tx)
    const list = byMerchant.get(key) || byMerchant.set(key, []).get(key)!
    list.push({ id: tx.id, date: tx.date.slice(0, 10), amount: round2(amount) })
  }

  const streams: DetectedStream[] = []
  for (const [key, charges] of byMerchant) {
    charges.sort((a, b) => a.date.localeCompare(b.date) || a.amount - b.amount)
    for (const cluster of clusterByAmount(charges)) {
      // Two charges on the same day (e.g. a retry) count once
      const deduped = cluster.filter((c, i) => i === 0 || c.date !== cluster[i - 1].date)
      const stream = analyzeStream(key, deduped, txById, today)
      if (stream && stream.confidence >= MIN_CONFIDENCE) streams.push(stream)
    }
  }
  return streams
}

// Pair stored decisions with detected streams. Decisions are keyed by
// merchant; when a merchant has several streams, each decision takes the
// stream closest to the amount it was saved with.
export function buildSubscriptionViews(streams: DetectedStream[], decisions: SubscriptionDecision[]): SubscriptionView[] {
  const views: SubscriptionView[] = []
  const claimed = new Set<DetectedStream>()

  const streamsByKey = new Map<string, DetectedStream[]>()
  for (const s of streams) (streamsByKey.get(s.merchantKey) || streamsByKey.set(s.merchantKey, []).get(s.merchantKey)!).push(s)

  for (const decision of decisions) {
    const candidates = (streamsByKey.get(decision.merchant_key) || []).filter(s => !claimed.has(s))
    const amount = Number(decision.amount)
    const nearest = candidates.sort((a, b) => Math.abs(a.lastAmount - amount) - Math.abs(b.lastAmount - amount))[0]
    // With several streams, only take one at a plausibly related price
    const stream = nearest && (candidates.length === 1 || Math.abs(nearest.lastAmount - amount) / amount <= 0.5) ? nearest : null
    if (stream) claimed.add(stream)
    views.push(toView(stream, decision))
  }

  for (const stream of streams) {
    if (!claimed.has(stream) && stream.active) views.push(toView(stream, null))
  }
  return views
}

function toView(stream: DetectedStream | null, decision: SubscriptionDecision | null): SubscriptionView {
  const cadence = stream?.cadence || decision!.cadence
  const amount = stream?.lastAmount ?? Number(decision!.amount)
  const status = decision?.status || "review"
  const detectedName = stream?.name || decision?.name || decision!.merchant_key
  return {
    id: decision?.id || null,
    merchantKey: stream?.merchantKey || decision!.merchant_key,
    name: decision?.name || detectedName,
    detectedName,
    logoUrl: stream?.logoUrl || null,
    status,
    cadence,
    amount,
    monthlyCost: monthlyCost(amount, cadence),
    lastDate: stream?.lastDate || null,
    // Cancelled and lapsed subscriptions have no next charge to expect
    nextDate: stream?.active && status !== "cancelled" ? stream.nextDate : null,
    charges: stream?.charges || [],
    confidence: stream?.confidence ?? 1,
    active: stream?.active ?? false,
    priceChange: stream?.priceChange || null,
    chargedAfterCancel: status === "cancelled" && !!decision?.cancelled_at && !!stream && stream.lastDate > decision.cancelled_at,
  }
}

// Client-side helpers shared by the Subscriptions page and dashboard card

export interface SubscriptionsData {
  subscriptions: SubscriptionView[]
  needsMigration: boolean
}

export const SUBSCRIPTIONS_CACHE_KEY = "subscriptions-v1"

export async function fetchSubscriptions(): Promise<SubscriptionsData> {
  const res = await fetch("/api/subscriptions", { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to load subscriptions")
  return res.json()
}

export function daysUntil(date: string, today = new Date()): number {
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / DAY_MS
  return Math.round(toDay(date) - start)
}

export function summarizeSubscriptions(subscriptions: SubscriptionView[], today = new Date()) {
  const tracked = subscriptions.filter(s => s.status === "tracked")
  const upcoming = tracked
    .filter(s => s.nextDate && daysUntil(s.nextDate, today) >= 0 && daysUntil(s.nextDate, today) <= 7)
    .sort((a, b) => a.nextDate!.localeCompare(b.nextDate!))
  const monthly = round2(tracked.reduce((sum, s) => sum + s.monthlyCost, 0))
  return {
    tracked,
    upcoming,
    monthly,
    yearly: round2(monthly * 12),
    reviewCount: subscriptions.filter(s => s.status === "review").length,
    // Things worth a look: new prices, charges after cancelling, plans that stopped billing
    alerts: subscriptions.filter(s =>
      s.chargedAfterCancel ||
      (s.status === "tracked" && (!!s.priceChange && s.priceChange.to > s.priceChange.from || !s.active))
    ),
  }
}
