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

    // Group by date → compute net worth per snapshot date
    const byDate = new Map<string, number>()
    for (const snap of snapshots) {
      const bal = Number(snap.balance)
      const value = snap.account_type === 'liability' ? -Math.abs(bal) : bal
      byDate.set(snap.snapshot_date, (byDate.get(snap.snapshot_date) || 0) + value)
    }

    // Pick the last snapshot per month (most accurate for that month)
    const byMonth = new Map<string, { date: string; netWorth: number }>()
    for (const [date, netWorth] of byDate) {
      const monthKey = date.substring(0, 7) // "YYYY-MM"
      const existing = byMonth.get(monthKey)
      if (!existing || date > existing.date) {
        byMonth.set(monthKey, { date, netWorth })
      }
    }

    // Sort chronologically and format for the chart
    const result = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, { netWorth }]) => {
        const [y, m] = monthKey.split('-').map(Number)
        return {
          month: new Date(y, m - 1).toLocaleString('default', { month: 'short', year: 'numeric' }),
          netWorth: Math.round(netWorth * 100) / 100,
        }
      })

    return NextResponse.json(result)
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
