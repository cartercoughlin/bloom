import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

// Accounts drop out of the total if they haven't been snapshotted for this
// long (e.g. a disconnected account), instead of being carried forward forever
const CARRY_FORWARD_DAYS = 45
const DAY_MS = 24 * 60 * 60 * 1000

interface Snapshot {
  snapshot_date: string
  account_type: string
  balance: number
  plaid_account_id: string | null
  account_name: string
}

// GET /api/net-worth-history?months=12[&group=month]
// Returns one point per snapshot date: [{ date, assets, liabilities, netWorth }],
// or the last point of each month with group=month
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const months = Math.min(36, Math.max(1, Number(request.nextUrl.searchParams.get('months')) || 12))
    const start = new Date()
    start.setMonth(start.getMonth() - months)
    // Look back a little further so balances can carry into the first point
    const lookback = new Date(start.getTime() - CARRY_FORWARD_DAYS * DAY_MS)
    const startDate = start.toISOString().split('T')[0]

    const snapshots = await fetchAllRows<Snapshot>((from, to) =>
      supabase
        .from('balance_snapshots')
        .select('snapshot_date, account_type, balance, plaid_account_id, account_name')
        .eq('user_id', user.id)
        .gte('snapshot_date', lookback.toISOString().split('T')[0])
        .order('snapshot_date', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    )

    // Snapshots only exist for accounts synced that day, so a date's total
    // uses each account's most recent balance as of that date.
    const latest = new Map<string, { date: string; type: string; balance: number }>()
    const dates = [...new Set(snapshots.map(s => s.snapshot_date))]
    const byDate = new Map<string, Snapshot[]>()
    for (const s of snapshots) {
      ;(byDate.get(s.snapshot_date) || byDate.set(s.snapshot_date, []).get(s.snapshot_date)!).push(s)
    }

    const points = []
    for (const date of dates) {
      for (const s of byDate.get(date)!) {
        latest.set(s.plaid_account_id || s.account_name, { date, type: s.account_type, balance: Number(s.balance) })
      }
      if (date < startDate) continue

      const dateMs = new Date(date).getTime()
      let assets = 0
      let liabilities = 0
      for (const acct of latest.values()) {
        if (dateMs - new Date(acct.date).getTime() > CARRY_FORWARD_DAYS * DAY_MS) continue
        if (acct.type === 'liability') liabilities += Math.abs(acct.balance)
        else assets += acct.balance
      }
      points.push({
        date,
        assets: Math.round(assets * 100) / 100,
        liabilities: Math.round(liabilities * 100) / 100,
        netWorth: Math.round((assets - liabilities) * 100) / 100,
      })
    }

    if (request.nextUrl.searchParams.get('group') === 'month') {
      const lastPerMonth = new Map<string, (typeof points)[number]>()
      for (const p of points) lastPerMonth.set(p.date.slice(0, 7), p)
      return NextResponse.json([...lastPerMonth.values()])
    }

    return NextResponse.json(points)
  } catch (error) {
    console.error('Net worth history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
