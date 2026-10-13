/**
 * Daily Digest Cron Job
 *
 * Called daily by Vercel Cron to send budget digests to opted-in users.
 * Schedule: 0 16 * * * (4 PM UTC / noon Eastern) — see vercel.json
 */

import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { generateDigestData } from '@/lib/email/generate-digest-data'
import { generateBudgetDigestHTML } from '@/lib/email/budget-digest-template'
import { syncPlaidTransactions } from '@/lib/plaid-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Stop syncing this long into the run so there's time left to build and send emails
const SYNC_DEADLINE_MS = 25_000

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<'timeout'>(resolve => { timer = setTimeout(() => resolve('timeout'), ms) })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

async function syncUserTransactions(supabase: SupabaseClient, userId: string) {
  try {
    const { data: plaidItems } = await supabase
      .from('plaid_items')
      .select('access_token')
      .eq('user_id', userId)
      .eq('sync_transactions', true)

    for (const item of plaidItems || []) {
      if (!item.access_token) continue
      const syncResult = await syncPlaidTransactions(item.access_token, {
        userId,
        supabaseClient: supabase,
        syncTransactions: true,
        syncBalances: false,
      })
      if (!syncResult.success) {
        console.warn(`[DailyDigest] Sync warning for ${userId}: ${syncResult.error}`)
      } else {
        console.log(`[DailyDigest] Synced ${syncResult.newTransactions} new, ${syncResult.updatedTransactions} updated for ${userId}`)
      }
    }
  } catch (syncErr) {
    const msg = syncErr instanceof Error ? syncErr.message : 'Unknown sync error'
    console.warn(`[DailyDigest] Sync failed for ${userId}, continuing with existing data: ${msg}`)
  }
}

export async function GET(request: Request) {
  const startedAt = Date.now()
  // Log immediately so we can always see invocations in Vercel logs
  console.log('[DailyDigest] Cron invoked')

  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('[DailyDigest] Auth failed — CRON_SECRET mismatch')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const resendApiKey = process.env.RESEND_API_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[DailyDigest] Missing SUPABASE env vars')
      return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 })
    }

    if (!resendApiKey) {
      console.error('[DailyDigest] Missing RESEND_API_KEY')
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Get opted-in users with their additional emails
    const { data: usersWithDigest, error: usersError } = await supabase
      .from('email_preferences')
      .select('user_id, additional_emails')
      .eq('daily_digest_enabled', true)

    if (usersError) {
      console.error('[DailyDigest] DB error fetching users:', usersError.message)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    if (!usersWithDigest || usersWithDigest.length === 0) {
      console.log('[DailyDigest] No opted-in users')
      return NextResponse.json({ success: true, sent: 0 })
    }

    console.log(`[DailyDigest] Processing ${usersWithDigest.length} user(s)`)

    const results = { sent: 0, failed: 0, skipped: 0, errors: [] as string[] }

    for (const userPref of usersWithDigest) {
      const userId = userPref.user_id
      try {
        // Get email via admin API
        const { data: { user: authUser }, error: authError } =
          await supabase.auth.admin.getUserById(userId)

        if (authError || !authUser?.email) {
          console.warn(`[DailyDigest] No email for ${userId}`)
          results.skipped++
          continue
        }

        // Refresh transactions before generating the digest so data is up-to-date.
        // The sync is best-effort and time-boxed: a slow bank sync used to eat
        // the whole function timeout, killing the run before any email went out.
        // The 2 AM sync cron keeps data reasonably fresh if this is skipped.
        const syncBudgetMs = Math.max(0, SYNC_DEADLINE_MS - (Date.now() - startedAt))
        const syncOutcome = await withTimeout(syncUserTransactions(supabase, userId), syncBudgetMs)
        if (syncOutcome === 'timeout') {
          console.warn(`[DailyDigest] Sync for ${userId} exceeded ${syncBudgetMs}ms, sending with existing data`)
        }

        // Generate digest
        const digestData = await generateDigestData(supabase, userId)
        if (!digestData) {
          console.log(`[DailyDigest] No budget data for ${userId}`)
          results.skipped++
          continue
        }

        const htmlContent = generateBudgetDigestHTML(digestData)

        // Build recipient list: account email + any additional emails
        const recipients = [authUser.email, ...(userPref.additional_emails || [])]

        // Send via Resend
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'Budget Digest <digest@yourdomain.com>',
            to: recipients,
            subject: `Your Daily Budget Digest - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
            html: htmlContent,
          }),
        })

        if (!emailRes.ok) {
          const err = await emailRes.text()
          console.error(`[DailyDigest] Resend error for ${recipients.join(', ')}: ${err}`)
          results.failed++
          results.errors.push(`${recipients.join(', ')}: ${err}`)
        } else {
          const { id } = await emailRes.json()
          console.log(`[DailyDigest] Sent to ${recipients.join(', ')}: ${id}`)
          results.sent++
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        console.error(`[DailyDigest] Error for ${userId}: ${msg}`)
        results.failed++
        results.errors.push(`${userId}: ${msg}`)
      }
    }

    console.log(`[DailyDigest] Done: ${results.sent} sent, ${results.failed} failed, ${results.skipped} skipped`)
    return NextResponse.json({ success: true, ...results })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[DailyDigest] Fatal: ${msg}`)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
