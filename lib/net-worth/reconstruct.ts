// Estimate net worth history by working backwards from today's balances
// through each account's transactions.
//
// - Bank accounts: undo each day's posted deposits and withdrawals.
// - Credit cards: undo purchases (which raise what's owed) and payments.
// - Investment accounts whose transactions aren't synced (e.g. Betterment,
//   where Plaid only gives us the total): their combined balance moves only
//   by transfers we can see on the bank side. A bank debit mentioning the
//   investment provider was a deposit into it; a bank credit, a withdrawal.
//   Market gains and losses can't be reconstructed, so between transfers
//   the investment total stays flat.
// - A real balance snapshot for a day replaces the estimate for that account.

export interface CurrentAccount {
  plaid_account_id: string | null
  account_name: string
  account_type: string // "liability" or an asset type
  balance: number
}

export interface BalanceTransaction {
  plaid_account_id: string
  amount: number
  transaction_type: string // "debit" | "credit"
  date: string // YYYY-MM-DD
  description?: string | null
  merchant_name?: string | null
  pending?: boolean
  counterparty_names?: string[]
}

export interface SnapshotRow {
  snapshot_date: string
  plaid_account_id: string | null
  account_name: string
  balance: number
}

export interface NetWorthPoint {
  date: string
  assets: number
  liabilities: number
  netWorth: number
  // false only for today and for days where every account had a real snapshot
  estimated: boolean
}

// Per-account view of the estimate, to sanity-check where it comes from
export interface AccountEstimate {
  name: string
  type: string
  kind: "transactions" | "investment" // investment: moved only by matched transfers
  current: number
  start: number // estimated balance at coverageStart
  transactionCount: number
  firstTransaction: string | null
}

export interface ReconstructionResult {
  points: NetWorthPoint[]
  // First day we have transaction coverage for every active account
  coverageStart: string
  // Bank transactions treated as transfers into/out of investment accounts
  investmentTransferCount: number
  investmentAccountNames: string[]
  accounts: AccountEstimate[]
}

// Bank transactions mentioning these are transfers to/from investment
// accounts whose own transactions aren't synced
export const INVESTMENT_TRANSFER_KEYWORDS = ["betterment"]

// Accounts with only a handful of transactions don't tell us where coverage starts
const MIN_TX_FOR_COVERAGE = 3

const keyOf = (a: { plaid_account_id: string | null; account_name: string }) =>
  a.plaid_account_id || `manual:${a.account_name}`

const round = (n: number) => Math.round(n * 100) / 100

function previousDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number)
  const prev = new Date(Date.UTC(y, m - 1, d - 1))
  return prev.toISOString().slice(0, 10)
}

function mentionsInvestment(tx: BalanceTransaction, keywords: string[]): boolean {
  const text = [tx.description, tx.merchant_name, ...(tx.counterparty_names || [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  return keywords.some(k => text.includes(k))
}

export function reconstructNetWorth({
  accounts,
  transactions,
  snapshots,
  today,
  earliest,
  keywords = INVESTMENT_TRANSFER_KEYWORDS,
}: {
  accounts: CurrentAccount[]
  transactions: BalanceTransaction[]
  snapshots: SnapshotRow[]
  today: string
  earliest: string // never reconstruct before this date
  keywords?: string[]
}): ReconstructionResult {
  const posted = transactions.filter(tx => !tx.pending && tx.date <= today)

  // Daily net change per account, as the change to that account's balance:
  // assets go up with credits; liabilities (amount owed) go up with debits
  const isLiability = new Map(accounts.map(a => [keyOf(a), a.account_type === "liability"]))
  const accountKeys = new Set(accounts.map(keyOf))
  const deltas = new Map<string, Map<string, number>>()
  const firstTxDate = new Map<string, string>()
  const txCount = new Map<string, number>()
  for (const tx of posted) {
    const key = tx.plaid_account_id
    if (!accountKeys.has(key)) continue
    const signed = tx.transaction_type === "credit" ? Number(tx.amount) : -Number(tx.amount)
    const change = isLiability.get(key) ? -signed : signed
    const byDay = deltas.get(key) || deltas.set(key, new Map()).get(key)!
    byDay.set(tx.date, (byDay.get(tx.date) || 0) + change)
    if (!firstTxDate.has(key) || tx.date < firstTxDate.get(key)!) firstTxDate.set(key, tx.date)
    txCount.set(key, (txCount.get(key) || 0) + 1)
  }

  // Asset accounts with no transactions of their own: treat as one
  // investment pool that moves with transfers seen on the bank side
  const pool = accounts.filter(a => a.account_type !== "liability" && !deltas.has(keyOf(a)))
  const poolKeys = new Set(pool.map(keyOf))
  const poolDeltas = new Map<string, number>()
  let investmentTransferCount = 0
  if (pool.length > 0) {
    for (const tx of posted) {
      if (poolKeys.has(tx.plaid_account_id) || !accountKeys.has(tx.plaid_account_id)) continue
      if (isLiability.get(tx.plaid_account_id) || !mentionsInvestment(tx, keywords)) continue
      // Bank debit = money moved into the investment account
      const change = tx.transaction_type === "debit" ? Number(tx.amount) : -Number(tx.amount)
      poolDeltas.set(tx.date, (poolDeltas.get(tx.date) || 0) + change)
      investmentTransferCount++
    }
  }

  // Only go back as far as every regularly-used account has transactions
  let coverageStart = earliest
  for (const [key, first] of firstTxDate) {
    if ((txCount.get(key) || 0) >= MIN_TX_FOR_COVERAGE && first > coverageStart) coverageStart = first
  }
  // ...and no further back than the oldest data at all, so a wide window
  // doesn't draw years of flat line before the first transaction or snapshot
  const oldestData = [...firstTxDate.values(), ...snapshots.map(s => s.snapshot_date)].sort()[0] || today
  if (coverageStart < oldestData) coverageStart = oldestData
  if (coverageStart > today) coverageStart = today

  const snapshotsByDay = new Map<string, Map<string, number>>()
  for (const s of snapshots) {
    const byKey = snapshotsByDay.get(s.snapshot_date) || snapshotsByDay.set(s.snapshot_date, new Map()).get(s.snapshot_date)!
    byKey.set(keyOf(s), Number(s.balance))
  }

  // Walk backwards from today's balances
  const balance = new Map<string, number>()
  for (const a of accounts) {
    if (poolKeys.has(keyOf(a))) continue
    balance.set(keyOf(a), a.account_type === "liability" ? Math.abs(Number(a.balance)) : Number(a.balance))
  }
  let poolBalance = pool.reduce((s, a) => s + Number(a.balance), 0)

  const points: NetWorthPoint[] = []
  let startBalances = new Map(balance)
  let startPool = poolBalance
  for (let day = today; day >= coverageStart; day = previousDay(day)) {
    let anchored = day === today
    if (day !== today) {
      const snaps = snapshotsByDay.get(day)
      if (snaps) {
        for (const key of balance.keys()) {
          if (snaps.has(key)) balance.set(key, isLiability.get(key) ? Math.abs(snaps.get(key)!) : snaps.get(key)!)
        }
        if (pool.length > 0 && pool.every(a => snaps.has(keyOf(a)))) {
          poolBalance = pool.reduce((s, a) => s + snaps.get(keyOf(a))!, 0)
        }
        anchored = [...balance.keys()].every(k => snaps.has(k)) && pool.every(a => snaps.has(keyOf(a)))
      }
    }

    let assets = poolBalance
    let liabilities = 0
    for (const [key, value] of balance) {
      if (isLiability.get(key)) liabilities += value
      else assets += value
    }
    points.push({ date: day, assets: round(assets), liabilities: round(liabilities), netWorth: round(assets - liabilities), estimated: !anchored })
    if (day === coverageStart) {
      startBalances = new Map(balance)
      startPool = poolBalance
    }

    // Undo this day's activity to get the previous day's closing balances
    for (const [key, byDay] of deltas) {
      const change = byDay.get(day)
      if (change) balance.set(key, (balance.get(key) || 0) - change)
    }
    poolBalance -= poolDeltas.get(day) || 0
  }

  const poolCurrent = pool.reduce((s, a) => s + Number(a.balance), 0)
  const accountEstimates: AccountEstimate[] = accounts
    .filter(a => !poolKeys.has(keyOf(a)))
    .map(a => ({
      name: a.account_name,
      type: a.account_type,
      kind: "transactions" as const,
      current: round(a.account_type === "liability" ? Math.abs(Number(a.balance)) : Number(a.balance)),
      start: round(startBalances.get(keyOf(a)) ?? 0),
      transactionCount: txCount.get(keyOf(a)) || 0,
      firstTransaction: firstTxDate.get(keyOf(a)) || null,
    }))
  if (pool.length > 0) {
    accountEstimates.push({
      name: pool.map(a => a.account_name).join(", "),
      type: "investment",
      kind: "investment",
      current: round(poolCurrent),
      start: round(startPool),
      transactionCount: investmentTransferCount,
      firstTransaction: null,
    })
  }

  return {
    points: points.reverse(),
    coverageStart,
    investmentTransferCount,
    investmentAccountNames: pool.map(a => a.account_name),
    accounts: accountEstimates,
  }
}
