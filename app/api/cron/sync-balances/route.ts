import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncAccountBalances } from '@/lib/plaid-sync-improved';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Standalone balance sync (not scheduled in vercel.json: the nightly
 * /api/cron/sync-transactions job already syncs balances and records
 * snapshots). Kept for manual or future scheduled use.
 */
export async function GET(request: Request) {
  try {
    // Verify this is a Vercel Cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron] Starting weekly balance sync...');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
    }

    // Service role: cron requests carry no user session for RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get all users with Plaid items configured for balance sync
    const { data: plaidItems, error: plaidError } = await supabase
      .from('plaid_items')
      .select('user_id, access_token, institution_name, sync_balances')
      .eq('sync_balances', true);

    if (plaidError) {
      console.error('[Cron] Database error:', plaidError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!plaidItems || plaidItems.length === 0) {
      console.log('[Cron] No accounts configured for balance sync');
      return NextResponse.json({
        success: true,
        message: 'No accounts to sync',
        syncedUsers: 0,
        syncedAccounts: 0,
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
    let totalSyncedAccounts = 0;
    const errors: string[] = [];

    // Sync for each user
    for (const [userId, items] of Object.entries(userGroups)) {
      try {
        console.log(`[Cron] Syncing balances for user ${userId}...`);

        for (const item of items) {
          const result = await syncAccountBalances(item.access_token, userId, supabase);

          if (result.success) {
            totalSyncedAccounts += result.syncedAccounts;
          } else {
            errors.push(`User ${userId} (${item.institution_name}): ${result.errors.join(', ')}`);
          }
        }

        totalSyncedUsers++;
      } catch (userError) {
        console.error(`[Cron] Error syncing user ${userId}:`, userError);
        errors.push(`User ${userId}: ${userError instanceof Error ? userError.message : 'Unknown error'}`);
      }
    }

    console.log(`[Cron] Weekly sync complete. Synced ${totalSyncedUsers} users, ${totalSyncedAccounts} accounts`);

    return NextResponse.json({
      success: errors.length === 0,
      syncedUsers: totalSyncedUsers,
      syncedAccounts: totalSyncedAccounts,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Cron] Balance sync error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Sync failed',
    }, { status: 500 });
  }
}
