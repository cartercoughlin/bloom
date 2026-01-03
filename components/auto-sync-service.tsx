'use client'

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
      await performAutoSync();

      // Don't reload on initial mount - only on scheduled syncs
      // This prevents infinite reload loops
      if (isInitialSync) {
        console.log('[AutoSync] Initial sync complete (no reload)');
        return;
      }

      // Clear all cached data to ensure fresh data loads
      console.log('[AutoSync] Clearing cache...');
      await cache.removePattern('dashboard-');
      await cache.remove('transactions-page');

      // Reload the page to show updated data
      // This is necessary because the pages use client-side data fetching
      // and router.refresh() doesn't trigger useEffect re-runs
      console.log('[AutoSync] Refreshing page...');
      window.location.reload();
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
