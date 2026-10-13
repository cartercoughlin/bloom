import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import {
  reconstructNetWorth,
  type BalanceTransaction,
  type CurrentAccount,
  type SnapshotRow,
} from '@/lib/net-worth/reconstruct'

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// POST /api/net-worth-history?months=12[&group=month]
// Body: { accounts: [{ plaid_account_id, account_name, account_type, balance }] }
//   (the live balances the page shows, so history ends exactly at them)
// GET falls back to the stored account_balances rows.
//
// Returns { points: [{ date, assets, liabilities, netWorth, estimated }], coverageStart,
// investmentTransferCount, investmentAccountNames }. History is estimated by working
// backwards from today's balances through transactions; see lib/net-worth/reconstruct.ts.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const accounts = Array.isArray(body?.accounts) ? (body.accounts as CurrentAccount[]) : null
  return buildHistory(request, accounts)
}

export async function GET(request: NextRequest) {
  return buildHistory(request, null)
}

async function buildHistory(request: NextRequest, providedAccounts: CurrentAccount[] | null) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const months = Math.min(24, Math.max(1, Number(request.nextUrl.searchParams.get('months')) || 12))
    const now = new Date()
    const today = localDate(now)
    const start = new Date(now)
    start.setMonth(start.getMonth() - months)
    const earliest = localDate(start)

    let accounts = providedAccounts
    if (!accounts) {
      const { data } = await supabase
        .from('account_balances')
        .select('plaid_account_id, account_name, account_type, balance')
        .eq('user_id', user.id)
      accounts = (data || []) as CurrentAccount[]
    }
    accounts = accounts
      .filter(a => a && typeof a.account_name === 'string' && Number.isFinite(Number(a.balance)))
      .map(a => ({
        plaid_account_id: a.plaid_account_id || null,
        account_name: a.account_name,
        account_type: a.account_type,
        balance: Number(a.balance),
      }))

    const [transactions, snapshots] = await Promise.all([
      fetchTransactions(supabase, user.id, earliest),
      fetchAllRows<SnapshotRow>((from, to) =>
        supabase
          .from('balance_snapshots')
          .select('snapshot_date, plaid_account_id, account_name, balance')
          .eq('user_id', user.id)
          .gte('snapshot_date', earliest)
          .order('snapshot_date')
          .order('id')
          .range(from, to)
      ),
    ])

    const result = reconstructNetWorth({ accounts, transactions, snapshots, today, earliest })

    if (request.nextUrl.searchParams.get('group') === 'month') {
      const lastPerMonth = new Map<string, (typeof result.points)[number]>()
      for (const p of result.points) lastPerMonth.set(p.date.slice(0, 7), p)
      return NextResponse.json({ ...result, points: [...lastPerMonth.values()] })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Net worth history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Every posted transaction on a linked account, including hidden ones (they
// still moved money). Deleted rows are skipped: they're mostly duplicates.
async function fetchTransactions(supabase: any, userId: string, earliest: string): Promise<BalanceTransaction[]> {
  const query = (columns: string) => (from: number, to: number) =>
    supabase
      .from('transactions')
      .select(columns)
      .eq('user_id', userId)
      .gte('date', earliest)
      .not('plaid_account_id', 'is', null)
      .not('deleted', 'is', true)
      .order('date')
      .order('id')
      .range(from, to)

  const base = 'plaid_account_id, amount, transaction_type, date, description, merchant_name'
  let rows: any[]
  try {
    rows = await fetchAllRows<any>(query(`${base}, plaid_details`))
  } catch {
    // plaid_details column not added yet (migrations/add-plaid-details.sql)
    rows = await fetchAllRows<any>(query(base))
  }

  return rows.map(r => ({
    plaid_account_id: r.plaid_account_id,
    amount: Number(r.amount),
    transaction_type: r.transaction_type,
    date: String(r.date).slice(0, 10),
    description: r.description,
    merchant_name: r.merchant_name,
    pending: r.plaid_details?.pending === true,
    counterparty_names: (r.plaid_details?.counterparties || []).map((c: any) => c.name).filter(Boolean),
  }))
}
