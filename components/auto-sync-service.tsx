'use client'

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { performAutoSync } from '@/lib/auto-sync';
import { isPWAOrMobile, cache } from '@/lib/capacitor';

/**
 * Background service that automatically syncs transactions and balances
 * - Transactions: Daily (every 24 hours)
 * - Balances: Weekly (every 7 days)
 *
 * Only runs in PWA/mobile, not in regular web browser
 * Automatically refreshes the UI after successful sync
 */
export function AutoSyncService() {
  const router = useRouter();

  useEffect(() => {
    // Only run auto-sync in PWA or mobile app, not in regular browser
    if (!isPWAOrMobile()) {
      console.log('[AutoSync] Skipping - running in web browser');
      return;
    }

    console.log('[AutoSync] Service initialized');

    // Wrapper function that syncs and refreshes UI
    const syncAndRefresh = async (isInitialSync = false) => {
      console.log('[AutoSync] Running sync...');
      const result = await performAutoSync();

      // Don't reload on initial mount - only on scheduled syncs
      // This prevents infinite reload loops
      if (isInitialSync) {
        console.log('[AutoSync] Initial sync complete (no reload)');
        return;
      }

      // Show notification if anything was synced
      const newTxCount = result.transactions.newTransactions || 0;
      const updatedTxCount = result.transactions.updatedTransactions || 0;
      const totalTxCount = newTxCount + updatedTxCount;
      const balanceCount = result.balances.syncedAccounts || 0;

      if (totalTxCount > 0 || balanceCount > 0) {
        const messages = [];
        if (totalTxCount > 0) {
          messages.push(`${totalTxCount} transaction${totalTxCount !== 1 ? 's' : ''} synced`);
        }
        if (balanceCount > 0) {
          messages.push(`${balanceCount} account${balanceCount !== 1 ? 's' : ''} updated`);
        }

        toast.success(messages.join(', '));

        // Clear all cached data to ensure fresh data loads
        console.log('[AutoSync] Clearing cache...');
        await cache.removePattern('dashboard-');
        await cache.remove('transactions-page');

        // Reload the page to show updated data after a short delay
        // This is necessary because the pages use client-side data fetching
        // and router.refresh() doesn't trigger useEffect re-runs
        setTimeout(() => {
          console.log('[AutoSync] Refreshing page...');
          window.location.reload();
        }, 1500); // Give user time to see the notification
      } else {
        console.log('[AutoSync] No new data to sync');
      }
    };

    // Run sync check immediately on mount (don't reload)
    syncAndRefresh(true);

    // Check for sync every hour
    const intervalId = setInterval(() => {
      console.log('[AutoSync] Running scheduled check...');
      syncAndRefresh();
    }, 60 * 60 * 1000); // 1 hour

    return () => {
      clearInterval(intervalId);
      console.log('[AutoSync] Service stopped');
    };
  }, [router]);

  // This component renders nothing
  return null;
}
