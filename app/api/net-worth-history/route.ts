import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get snapshots from the last 6 months
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const startDate = sixMonthsAgo.toISOString().split('T')[0]

    const { data: snapshots, error } = await supabase
      .from('balance_snapshots')
      .select('snapshot_date, account_type, balance')
      .eq('user_id', user.id)
      .gte('snapshot_date', startDate)
      .order('snapshot_date', { ascending: true })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 })
    }

    if (!snapshots || snapshots.length === 0) {
      return NextResponse.json([])
    }

    // Group by date → compute account totals per snapshot date
    const byDate = new Map<string, { assets: number; liabilities: number }>()
    for (const snap of snapshots) {
      const bal = Number(snap.balance)
      const existing = byDate.get(snap.snapshot_date) || { assets: 0, liabilities: 0 }

      if (snap.account_type === 'liability') {
        existing.liabilities += Math.abs(bal)
      } else {
        existing.assets += bal
      }

      byDate.set(snap.snapshot_date, existing)
    }

    // Pick the last snapshot per month (most accurate for that month)
    const byMonth = new Map<string, { date: string; assets: number; liabilities: number; netWorth: number }>()
    for (const [date, totals] of byDate) {
      const monthKey = date.substring(0, 7) // "YYYY-MM"
      const existing = byMonth.get(monthKey)
      if (!existing || date > existing.date) {
        byMonth.set(monthKey, {
          date,
          assets: totals.assets,
          liabilities: totals.liabilities,
          netWorth: totals.assets - totals.liabilities,
        })
      }
    }

    // Sort chronologically and format for the chart
    const result = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, { assets, liabilities, netWorth }]) => {
        const [y, m] = monthKey.split('-').map(Number)
        return {
          month: new Date(y, m - 1).toLocaleString('default', { month: 'short', year: 'numeric' }),
          assets: Math.round(assets * 100) / 100,
          liabilities: Math.round(liabilities * 100) / 100,
          netWorth: Math.round(netWorth * 100) / 100,
        }
      })

    return NextResponse.json(result)
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
