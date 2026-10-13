import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncPlaidTransactions } from '@/lib/plaid-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Plaid keeps up to 2 years of transactions per connection
const MAX_DAYS_BACK = 730
// One window per request keeps each call well within the function time limit
const WINDOW_DAYS = 90

interface Cursor {
  itemIndex: number
  // Import the window ending the day before this date (YYYY-MM-DD)
  before: string | null
}

const isoDate = (d: Date) => d.toISOString().split('T')[0]
const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return isoDate(d)
}

// POST /api/plaid/backfill-history  body: { cursor?: Cursor }
// Imports older transactions (and links existing rows to their accounts) one
// 90-day window at a time, newest first, for each connection that syncs
// transactions. Call repeatedly with the returned cursor until done.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const cursor: Cursor = {
      itemIndex: Number.isInteger(body?.cursor?.itemIndex) ? body.cursor.itemIndex : 0,
      before: typeof body?.cursor?.before === 'string' ? body.cursor.before : null,
    }

    const { data: items, error } = await supabase
      .from('plaid_items')
      .select('access_token, institution_name')
      .eq('user_id', user.id)
      .eq('sync_transactions', true)
      .order('created_at')
    if (error) {
      return NextResponse.json({ error: 'Failed to load connections' }, { status: 500 })
    }

    const total = items?.length || 0
    const item = items?.[cursor.itemIndex]
    if (!item) {
      return NextResponse.json({ done: true, cursor: null, newTransactions: 0, updatedTransactions: 0, items: total })
    }

    const today = isoDate(new Date())
    const oldest = addDays(today, -MAX_DAYS_BACK)
    const endDate = cursor.before ? addDays(cursor.before, -1) : today
    const startDate = [addDays(endDate, -(WINDOW_DAYS - 1)), oldest].sort().pop()!

    const result = await syncPlaidTransactions(item.access_token, {
      userId: user.id,
      syncTransactions: true,
      syncBalances: false,
      startDate,
      endDate,
    })
    if (!result.success) {
      console.warn(`[Backfill] ${item.institution_name || 'connection'} ${startDate}..${endDate}: ${result.error}`)
    }

    const next: Cursor | null = startDate > oldest
      ? { itemIndex: cursor.itemIndex, before: startDate }
      : cursor.itemIndex + 1 < total
        ? { itemIndex: cursor.itemIndex + 1, before: null }
        : null

    return NextResponse.json({
      done: next === null,
      cursor: next,
      newTransactions: result.newTransactions || 0,
      updatedTransactions: result.updatedTransactions || 0,
      items: total,
      institution: item.institution_name || null,
      window: { startDate, endDate },
      error: result.success ? undefined : result.error,
    })
  } catch (error) {
    console.error('History backfill error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
