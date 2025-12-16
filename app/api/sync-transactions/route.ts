import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncPlaidTransactions } from '@/lib/plaid-sync'

export async function POST() {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's Plaid access tokens with sync preferences
    const { data: plaidItems, error: plaidError } = await supabase
      .from('plaid_items')
      .select('access_token, sync_transactions, sync_balances')
      .eq('user_id', user.id)

    if (plaidError) {
      console.error('Database error:', plaidError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!plaidItems || plaidItems.length === 0) {
      // No Plaid connections - clean up all Plaid data
      console.log('No Plaid connections found. Cleaning up all Plaid data...')
      
      // Remove all transactions with Plaid IDs
      const { error: txCleanupError } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id)
        .not('plaid_transaction_id', 'is', null)
      
      if (txCleanupError) {
        console.error('Error cleaning up Plaid transactions:', txCleanupError)
      }
      
      // Remove all account balances with Plaid IDs
      const { error: balanceCleanupError } = await supabase
        .from('account_balances')
        .delete()
        .eq('user_id', user.id)
        .not('plaid_account_id', 'is', null)
      
      if (balanceCleanupError) {
        console.error('Error cleaning up Plaid balances:', balanceCleanupError)
      }
      
      return NextResponse.json({ 
        success: true,
        message: 'All Plaid data cleaned up. Connect a bank account to sync transactions.',
        newTransactions: 0,
        updatedTransactions: 0,
        totalProcessed: 0,
        syncedAccounts: 0
      })
    }

    // Get all current account IDs from all active Plaid connections
    let allCurrentAccountIds: string[] = []
    
    let totalNewTransactions = 0
    let totalUpdatedTransactions = 0
    let totalProcessed = 0
    let totalSyncedAccounts = 0
    const errors: string[] = []

    // Sync transactions for each connected account
    for (const item of plaidItems) {
      try {
        const result = await syncPlaidTransactions(item.access_token, {
          syncTransactions: item.sync_transactions,
          syncBalances: item.sync_balances
        })

        // Always collect account IDs, even if sync failed
        // This prevents cleanup from deleting transactions when there's a sync error
        if (result.accountIds) {
          allCurrentAccountIds = [...allCurrentAccountIds, ...result.accountIds]
        }

        if (result.success) {
          totalNewTransactions += result.newTransactions
          totalUpdatedTransactions += result.updatedTransactions
          totalProcessed += result.totalProcessed
          totalSyncedAccounts += result.syncedAccounts || 0
        } else {
          errors.push(result.error || 'Unknown sync error')
        }
      } catch (itemError) {
        console.error('Item sync error:', itemError)
        errors.push(`Sync failed for one account: ${itemError instanceof Error ? itemError.message : 'Unknown error'}`)
      }
    }

    // Clean up old accounts and transactions that are no longer in ANY active Plaid connection
    if (allCurrentAccountIds.length > 0) {
      console.log('Cleaning up old accounts. Current account IDs:', allCurrentAccountIds)

      // Get all Plaid accounts for this user
      const { data: allPlaidAccounts } = await supabase
        .from('account_balances')
        .select('id, plaid_account_id')
        .eq('user_id', user.id)
        .not('plaid_account_id', 'is', null)

      // Find accounts that should be removed (not in current account IDs)
      const accountsToRemove = allPlaidAccounts?.filter(acc =>
        acc.plaid_account_id && !allCurrentAccountIds.includes(acc.plaid_account_id)
      ) || []

      if (accountsToRemove.length > 0) {
        const accountIdsToRemove = accountsToRemove.map(acc => acc.plaid_account_id)
        const dbIdsToRemove = accountsToRemove.map(acc => acc.id)
        console.log('Removing transactions for disconnected accounts:', accountIdsToRemove)

        // Remove transactions from disconnected accounts
        const { error: txCleanupError } = await supabase
          .from('transactions')
          .delete()
          .eq('user_id', user.id)
          .in('plaid_account_id', accountIdsToRemove)

        if (txCleanupError) {
          console.error('Error cleaning up transactions:', txCleanupError)
        }

        // Remove account balances
        const { error: cleanupError } = await supabase
          .from('account_balances')
          .delete()
          .in('id', dbIdsToRemove)

        if (cleanupError) {
          console.error('Error cleaning up old accounts:', cleanupError)
        } else {
          console.log('Successfully cleaned up old accounts and transactions')
        }
      } else {
        console.log('No old accounts to clean up')
      }
    }

    return NextResponse.json({ 
      success: errors.length === 0,
      newTransactions: totalNewTransactions,
      updatedTransactions: totalUpdatedTransactions,
      totalProcessed: totalProcessed,
      syncedAccounts: totalSyncedAccounts,
      message: errors.length === 0 ? 'Transactions synced successfully' : `Partial sync completed with ${errors.length} errors`,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Sync failed' 
    }, { status: 500 })
  }
}
