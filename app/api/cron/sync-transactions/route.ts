import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncPlaidTransactions } from '@/lib/plaid-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Vercel Cron Job: Daily transaction and balance sync
 * Runs at 2 AM UTC every day
 *
 * For each connection, syncs transactions and/or balances per its settings.
 * Each balance sync records the day's balance snapshot for the net worth
 * chart. Balances come from /accounts/get (Plaid's cached balances, free;
 * refreshed by Plaid about daily), not the paid live /accounts/balance/get.
 */
export async function GET(request: Request) {
  try {
    // Verify this is a Vercel Cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron] Starting daily transaction and balance sync...');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Cron] Missing SUPABASE env vars');
      return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
    }

    // Service role: cron requests carry no user session, so the cookie-based
    // client saw no plaid_items through RLS and silently synced nothing.
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get all users with Plaid items
    const { data: plaidItems, error: plaidError } = await supabase
      .from('plaid_items')
      .select('user_id, access_token, sync_transactions, sync_balances')
      .or('sync_transactions.eq.true,sync_balances.eq.true');

    if (plaidError) {
      console.error('[Cron] Database error:', plaidError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!plaidItems || plaidItems.length === 0) {
      console.log('[Cron] No accounts configured for transaction sync');
      return NextResponse.json({
        success: true,
        message: 'No accounts to sync',
        syncedUsers: 0,
      });
    }

    // Group by user_id to sync per user
    const userGroups = plaidItems.reduce((acc, item) => {
      if (!acc[item.user_id]) {
        acc[item.user_id] = [];
      }
      acc[item.user_id].push(item);
      return acc;
    }, {} as Record<string, typeof plaidItems>);

    let totalSyncedUsers = 0;
    let totalNewTransactions = 0;
    let totalSyncedAccounts = 0;
    const errors: string[] = [];

    // Sync for each user
    for (const [userId, items] of Object.entries(userGroups)) {
      try {
        console.log(`[Cron] Syncing user ${userId}...`);

        for (const item of items) {
          const result = await syncPlaidTransactions(item.access_token, {
            userId,
            supabaseClient: supabase,
            syncTransactions: item.sync_transactions === true,
            syncBalances: item.sync_balances === true,
          });

          if (result.success) {
            totalNewTransactions += result.newTransactions;
            totalSyncedAccounts += result.syncedAccounts || 0;
          } else {
            errors.push(`User ${userId}: ${result.error}`);
          }
        }

        totalSyncedUsers++;
      } catch (userError) {
        console.error(`[Cron] Error syncing user ${userId}:`, userError);
        errors.push(`User ${userId}: ${userError instanceof Error ? userError.message : 'Unknown error'}`);
      }
    }

    console.log(`[Cron] Daily sync complete. Synced ${totalSyncedUsers} users, ${totalNewTransactions} new transactions, ${totalSyncedAccounts} account balances`);

    return NextResponse.json({
      success: errors.length === 0,
      syncedUsers: totalSyncedUsers,
      newTransactions: totalNewTransactions,
      syncedAccounts: totalSyncedAccounts,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Cron] Transaction sync error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Sync failed',
    }, { status: 500 });
  }
}
