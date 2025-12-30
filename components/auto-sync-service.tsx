'use client'

import { useEffect } from 'react';
import { performAutoSync } from '@/lib/auto-sync';
import { isPWAOrMobile } from '@/lib/capacitor';

/**
 * Background service that automatically syncs transactions and balances
 * - Transactions: Daily (every 24 hours)
 * - Balances: Weekly (every 7 days)
 *
 * Only runs in PWA/mobile, not in regular web browser
 */
export function AutoSyncService() {
  useEffect(() => {
    // Only run auto-sync in PWA or mobile app, not in regular browser
    if (!isPWAOrMobile()) {
      console.log('[AutoSync] Skipping - running in web browser');
      return;
    }

    console.log('[AutoSync] Service initialized');

    // Run sync check immediately on mount
    performAutoSync();

    // Check for sync every hour
    const intervalId = setInterval(() => {
      console.log('[AutoSync] Running scheduled check...');
      performAutoSync();
    }, 60 * 60 * 1000); // 1 hour

    return () => {
      clearInterval(intervalId);
      console.log('[AutoSync] Service stopped');
    };
  }, []);

  // This component renders nothing
  return null;
}
