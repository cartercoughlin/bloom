/**
 * Daily Digest Cron Job
 *
 * This endpoint is called daily by Vercel Cron to send budget digests
 * to all users who have daily_digest_enabled = true
 *
 * Setup in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/daily-digest",
 *     "schedule": "0 8 * * *"
 *   }]
 * }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateDigestData } from '@/lib/email/generate-digest-data'
import { generateBudgetDigestHTML } from '@/lib/email/budget-digest-template'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max

export async function GET(request: Request) {
  try {
    // Verify cron secret to prevent unauthorized calls
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[DailyDigest] Starting daily digest cron job')

    // Create Supabase client with service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get all users with daily digest enabled
    const { data: usersWithDigest, error: usersError } = await supabase
      .from('email_preferences')
      .select('user_id, users:user_id(email)')
      .eq('daily_digest_enabled', true)

    if (usersError) {
      console.error('[DailyDigest] Error fetching users:', usersError)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    if (!usersWithDigest || usersWithDigest.length === 0) {
      console.log('[DailyDigest] No users with daily digest enabled')
      return NextResponse.json({
        success: true,
        message: 'No users to send digests to',
        sent: 0
      })
    }

    console.log(`[DailyDigest] Found ${usersWithDigest.length} users to send digests to`)

    // Resend API setup
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      console.error('[DailyDigest] RESEND_API_KEY not configured')
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
    }

    const results = {
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: [] as Array<{ userId: string; error: string }>
    }

    // Send digest to each user
    for (const userPref of usersWithDigest) {
      try {
        const userId = userPref.user_id
        const userEmail = (userPref.users as any)?.email

        if (!userEmail) {
          console.warn(`[DailyDigest] No email for user ${userId}`)
          results.skipped++
          continue
        }

        // Generate digest data for this user
        const digestData = await generateDigestData(supabase, userId)

        if (!digestData) {
          console.log(`[DailyDigest] No budget data for user ${userId}`)
          results.skipped++
          continue
        }

        // Generate HTML email
        const htmlContent = generateBudgetDigestHTML(digestData)

        // Send email via Resend
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'Budget Digest <digest@yourdomain.com>',
            to: [userEmail],
            subject: `Your Daily Budget Digest - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
            html: htmlContent
          })
        })

        if (!emailResponse.ok) {
          const error = await emailResponse.json()
          console.error(`[DailyDigest] Failed to send to ${userEmail}:`, error)
          results.failed++
          results.errors.push({
            userId,
            error: error.message || 'Unknown error'
          })
          continue
        }

        const emailResult = await emailResponse.json()
        console.log(`[DailyDigest] Sent to ${userEmail}: ${emailResult.id}`)
        results.sent++

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error('[DailyDigest] Error processing user:', error)
        results.failed++
        results.errors.push({
          userId: userPref.user_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    console.log('[DailyDigest] Completed:', results)

    return NextResponse.json({
      success: true,
      message: 'Daily digest cron job completed',
      ...results
    })
  } catch (error) {
    console.error('[DailyDigest] Fatal error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
