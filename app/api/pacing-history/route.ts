import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import type { PacingHistory } from '@/lib/budget/pacing'

interface Row {
  category_id: string | null
  amount: number
  transaction_type: string
  date: string
}

// Months with less spending than this in a category say little about its timing
const MIN_MONTH_SPEND = 1

// GET /api/pacing-history?month=10&year=2026
// For each category, the average share of a month's net spending that had
// happened by each day of the month, across every complete month before the
// given one. shares[d] is the cumulative share through day d (shares[0] = 0).
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const month = parseInt(request.nextUrl.searchParams.get('month') || '', 10)
    const year = parseInt(request.nextUrl.searchParams.get('year') || '', 10)
    if (!month || !year || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Valid month (1-12) and year are required' }, { status: 400 })
    }
    const before = `${year}-${String(month).padStart(2, '0')}-01`

    const rows = await fetchAllRows<Row>((from, to) =>
      supabase
        .from('transactions')
        .select('category_id, amount, transaction_type, date')
        .eq('user_id', user.id)
        .lt('date', before)
        .not('category_id', 'is', null)
        .not('hidden', 'is', true)
        .not('deleted', 'is', true)
        .order('date')
        .order('id')
        .range(from, to)
    )

    // category -> "YYYY-MM" -> net spend per day of month (index 1-31)
    const daily = new Map<string, Map<string, number[]>>()
    for (const r of rows) {
      const key = r.date.slice(0, 7)
      const day = Number(r.date.slice(8, 10))
      const byMonth = daily.get(r.category_id!) || daily.set(r.category_id!, new Map()).get(r.category_id!)!
      const days = byMonth.get(key) || byMonth.set(key, new Array(32).fill(0)).get(key)!
      days[day] += r.transaction_type === 'credit' ? -Number(r.amount) : Number(r.amount)
    }

    const result: PacingHistory = {}
    for (const [categoryId, byMonth] of daily) {
      const sums = new Array(32).fill(0)
      let months = 0
      for (const [key, days] of byMonth) {
        const total = days.reduce((s, v) => s + v, 0)
        if (total < MIN_MONTH_SPEND) continue
        const [y, m] = key.split('-').map(Number)
        const length = new Date(y, m, 0).getDate()
        let cumulative = 0
        for (let d = 1; d <= 31; d++) {
          if (d <= length) cumulative += days[d]
          // Refunds can push the running total briefly past the month's net
          sums[d] += Math.min(1, Math.max(0, cumulative / total))
        }
        months++
      }
      if (months === 0) continue
      result[categoryId] = {
        months,
        shares: sums.map((s, d) => (d === 0 ? 0 : Math.round((s / months) * 10000) / 10000)),
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Pacing history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
