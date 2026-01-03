import { storage } from './capacitor';

const LAST_TRANSACTION_SYNC_KEY = 'last_transaction_sync';
const LAST_BALANCE_SYNC_KEY = 'last_balance_sync';

const ONE_DAY_MS = 24 * 60 * 60 * 1000; // 24 hours
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Check if enough time has passed since last sync
 */
async function shouldSync(storageKey: string, intervalMs: number): Promise<boolean> {
  const lastSyncStr = await storage.get(storageKey);

  if (!lastSyncStr) {
    // Never synced before
    return true;
  }

  const lastSyncTime = parseInt(lastSyncStr, 10);
  const now = Date.now();

  return (now - lastSyncTime) >= intervalMs;
}

/**
 * Update the last sync timestamp
 */
async function updateLastSync(storageKey: string): Promise<void> {
  await storage.set(storageKey, Date.now().toString());
}

/**
 * Sync transactions if it's been more than 24 hours
 */
export async function autoSyncTransactions(): Promise<{
  synced: boolean;
  reason?: string;
  newTransactions?: number;
  updatedTransactions?: number;
  totalProcessed?: number;
}> {
  try {
    const should = await shouldSync(LAST_TRANSACTION_SYNC_KEY, ONE_DAY_MS);

    if (!should) {
      return { synced: false, reason: 'Not enough time has passed since last sync' };
    }

    console.log('[AutoSync] Syncing transactions...');
    const response = await fetch('/api/sync-transactions', {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Transaction sync failed');
    }

    const result = await response.json();

    if (result.success) {
      await updateLastSync(LAST_TRANSACTION_SYNC_KEY);
      console.log('[AutoSync] Transactions synced successfully:', result);
      return {
        synced: true,
        newTransactions: result.newTransactions || 0,
        updatedTransactions: result.updatedTransactions || 0,
        totalProcessed: result.totalProcessed || 0,
      };
    }

    return { synced: false, reason: result.message || 'Sync failed' };
  } catch (error) {
    console.error('[AutoSync] Transaction sync error:', error);
    return { synced: false, reason: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Sync account balances if it's been more than 7 days
 */
export async function autoSyncBalances(): Promise<{
  synced: boolean;
  reason?: string;
  syncedAccounts?: number;
}> {
  try {
    const should = await shouldSync(LAST_BALANCE_SYNC_KEY, ONE_WEEK_MS);

    if (!should) {
      return { synced: false, reason: 'Not enough time has passed since last sync' };
    }

    console.log('[AutoSync] Syncing balances...');
    const response = await fetch('/api/sync-balances', {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Balance sync failed');
    }

    const result = await response.json();

    if (result.success) {
      await updateLastSync(LAST_BALANCE_SYNC_KEY);
      console.log('[AutoSync] Balances synced successfully:', result);
      return {
        synced: true,
        syncedAccounts: result.syncedAccounts || 0,
      };
    }

    return { synced: false, reason: result.message || 'Sync failed' };
  } catch (error) {
    console.error('[AutoSync] Balance sync error:', error);
    return { synced: false, reason: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Run both auto-sync checks
 */
export async function performAutoSync(): Promise<{
  transactions: {
    synced: boolean;
    newTransactions?: number;
    updatedTransactions?: number;
  };
  balances: {
    synced: boolean;
    syncedAccounts?: number;
  };
}> {
  console.log('[AutoSync] Starting automatic sync check...');

  // Run syncs in parallel
  const [transactionResult, balanceResult] = await Promise.all([
    autoSyncTransactions(),
    autoSyncBalances(),
  ]);

  console.log('[AutoSync] Transaction sync:', transactionResult);
  console.log('[AutoSync] Balance sync:', balanceResult);

  return {
    transactions: {
      synced: transactionResult.synced,
      newTransactions: transactionResult.newTransactions,
      updatedTransactions: transactionResult.updatedTransactions,
    },
    balances: {
      synced: balanceResult.synced,
      syncedAccounts: balanceResult.syncedAccounts,
    },
  };
}

/**
 * Get time remaining until next sync
 */
export async function getNextSyncInfo(): Promise<{
  transactions: { nextSync: Date; canSyncNow: boolean };
  balances: { nextSync: Date; canSyncNow: boolean };
}> {
  const lastTransactionSyncStr = await storage.get(LAST_TRANSACTION_SYNC_KEY);
  const lastBalanceSyncStr = await storage.get(LAST_BALANCE_SYNC_KEY);

  const now = Date.now();

  const lastTransactionSync = lastTransactionSyncStr ? parseInt(lastTransactionSyncStr, 10) : 0;
  const lastBalanceSync = lastBalanceSyncStr ? parseInt(lastBalanceSyncStr, 10) : 0;

  const nextTransactionSync = new Date(lastTransactionSync + ONE_DAY_MS);
  const nextBalanceSync = new Date(lastBalanceSync + ONE_WEEK_MS);

  return {
    transactions: {
      nextSync: nextTransactionSync,
      canSyncNow: lastTransactionSync === 0 || (now - lastTransactionSync) >= ONE_DAY_MS,
    },
    balances: {
      nextSync: nextBalanceSync,
      canSyncNow: lastBalanceSync === 0 || (now - lastBalanceSync) >= ONE_WEEK_MS,
    },
  };
}

/**
 * Force reset sync timers (useful for manual override)
 */
export async function resetSyncTimers(): Promise<void> {
  await storage.remove(LAST_TRANSACTION_SYNC_KEY);
  await storage.remove(LAST_BALANCE_SYNC_KEY);
  console.log('[AutoSync] Sync timers reset');
}
