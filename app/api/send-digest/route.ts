/**
 * Send Budget Digest Email
 *
 * API endpoint to send daily budget digest to a user
 * Can be called manually or via cron job
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateDigestData } from '@/lib/email/generate-digest-data'
import { generateBudgetDigestHTML } from '@/lib/email/budget-digest-template'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's email
    const userEmail = user.email
    if (!userEmail) {
      return NextResponse.json({ error: 'No email address found' }, { status: 400 })
    }

    // Check if user has email notifications enabled
    const { data: preferences } = await supabase
      .from('email_preferences')
      .select('daily_digest_enabled')
      .eq('user_id', user.id)
      .single()

    if (preferences && !preferences.daily_digest_enabled) {
      return NextResponse.json({
        success: false,
        message: 'Daily digest is disabled for this user'
      })
    }

    // Generate digest data
    const digestData = await generateDigestData(supabase, user.id)

    if (!digestData) {
      return NextResponse.json({
        success: false,
        message: 'No budget data available to send digest'
      })
    }

    // Generate HTML email
    const htmlContent = generateBudgetDigestHTML(digestData)

    // Send email using Resend
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      console.error('[SendDigest] RESEND_API_KEY not configured')
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      )
    }

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
      console.error('[SendDigest] Resend error:', error)
      return NextResponse.json(
        { error: 'Failed to send email', details: error },
        { status: 500 }
      )
    }

    const emailResult = await emailResponse.json()
    console.log('[SendDigest] Email sent successfully:', emailResult.id)

    return NextResponse.json({
      success: true,
      message: 'Digest email sent successfully',
      emailId: emailResult.id
    })
  } catch (error) {
    console.error('[SendDigest] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET endpoint to preview digest without sending
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Generate digest data
    const digestData = await generateDigestData(supabase, user.id)

    if (!digestData) {
      return new Response(
        '<html><body><h1>No Budget Data</h1><p>You don\'t have any budgets set up for this month.</p></body></html>',
        {
          headers: { 'Content-Type': 'text/html' }
        }
      )
    }

    // Generate HTML email
    const htmlContent = generateBudgetDigestHTML(digestData)

    // Return HTML for preview
    return new Response(htmlContent, {
      headers: { 'Content-Type': 'text/html' }
    })
  } catch (error) {
    console.error('[SendDigest] Preview error:', error)
    return new Response(
      `<html><body><h1>Error</h1><p>${error instanceof Error ? error.message : 'Unknown error'}</p></body></html>`,
      {
        headers: { 'Content-Type': 'text/html' }
      }
    )
  }
}
