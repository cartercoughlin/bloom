import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncPlaidTransactions } from '@/lib/plaid-sync';

/**
 * Vercel Cron Job: Daily transaction sync
 * Runs at 2 AM UTC every day
 *
 * This is a server-side backup to the client-side auto-sync
 */
export async function GET(request: Request) {
  try {
    // Verify this is a Vercel Cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron] Starting daily transaction sync...');

    const supabase = await createClient();

    // Get all users with Plaid items
    const { data: plaidItems, error: plaidError } = await supabase
      .from('plaid_items')
      .select('user_id, access_token, sync_transactions')
      .eq('sync_transactions', true);

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
      return {};
    }, {} as Record<string, typeof plaidItems>);

    let totalSyncedUsers = 0;
    let totalNewTransactions = 0;
    const errors: string[] = [];

    // Sync for each user
    for (const [userId, items] of Object.entries(userGroups)) {
      try {
        console.log(`[Cron] Syncing transactions for user ${userId}...`);

        for (const item of items) {
          const result = await syncPlaidTransactions(item.access_token, {
            syncTransactions: true,
            syncBalances: false,
          });

          if (result.success) {
            totalNewTransactions += result.newTransactions;
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

    console.log(`[Cron] Daily sync complete. Synced ${totalSyncedUsers} users, ${totalNewTransactions} new transactions`);

    return NextResponse.json({
      success: errors.length === 0,
      syncedUsers: totalSyncedUsers,
      newTransactions: totalNewTransactions,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Cron] Transaction sync error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Sync failed',
    }, { status: 500 });
  }
}
