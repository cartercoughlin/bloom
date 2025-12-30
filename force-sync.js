#!/usr/bin/env node

/**
 * Force Sync Script
 *
 * This script manually triggers a sync for all connected Plaid accounts
 * Run this after connecting a new account to force an immediate sync
 *
 * Usage:
 *   node force-sync.js
 */

const { createClient } = require('@supabase/supabase-js')
const { syncPlaidTransactions } = require('./lib/plaid-sync')

async function forceSyncAll() {
  console.log('🔄 Starting force sync...\n')

  // Initialize Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  // Get all plaid items
  const { data: plaidItems, error } = await supabase
    .from('plaid_items')
    .select('id, item_id, access_token, institution_name, account_name, sync_transactions, sync_balances')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Error fetching plaid items:', error)
    process.exit(1)
  }

  if (!plaidItems || plaidItems.length === 0) {
    console.log('ℹ️  No Plaid accounts found')
    process.exit(0)
  }

  console.log(`📋 Found ${plaidItems.length} connected account(s):\n`)
  plaidItems.forEach((item, index) => {
    console.log(`${index + 1}. ${item.institution_name || 'Unknown'} - ${item.account_name || 'Unknown'}`)
    console.log(`   Sync settings: Transactions=${item.sync_transactions}, Balances=${item.sync_balances}`)
  })
  console.log()

  let totalSynced = 0
  let totalFailed = 0

  // Sync each account
  for (const item of plaidItems) {
    console.log(`🔄 Syncing: ${item.institution_name || 'Unknown'}...`)

    try {
      const result = await syncPlaidTransactions(item.access_token, {
        syncTransactions: item.sync_transactions,
        syncBalances: item.sync_balances
      })

      if (result.success) {
        console.log(`✅ Success!`)
        console.log(`   New transactions: ${result.newTransactions}`)
        console.log(`   Updated transactions: ${result.updatedTransactions}`)
        console.log(`   Total processed: ${result.totalProcessed}`)
        console.log(`   Accounts synced: ${result.syncedAccounts || 0}`)
        totalSynced++
      } else {
        console.log(`❌ Failed: ${result.error}`)
        totalFailed++
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`)
      totalFailed++
    }
    console.log()
  }

  console.log('📊 Summary:')
  console.log(`   Successfully synced: ${totalSynced}`)
  console.log(`   Failed: ${totalFailed}`)
  console.log()
  console.log('✨ Force sync complete!')
}

// Run the sync
forceSyncAll().catch(error => {
  console.error('💥 Fatal error:', error)
  process.exit(1)
})
