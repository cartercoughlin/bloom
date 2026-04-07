import { plaidClient } from './plaid'
import { createClient } from '@/lib/supabase/server'
import { AccountsGetRequest, AccountsGetResponse } from 'plaid'

export async function syncAccountBalances(accessToken: string, userId: string): Promise<{
  success: boolean
  syncedAccounts: number
  errors: string[]
}> {
  const errors: string[] = []
  let syncedAccounts = 0

  try {
    console.log('🏦 Starting account balance sync...')
    
    const supabase = await createClient()
    
    // Get accounts from Plaid
    const accountsRequest: AccountsGetRequest = { access_token: accessToken }
    const accountsResponse: AccountsGetResponse = await plaidClient.accountsGet(accountsRequest)
    const accounts = accountsResponse.data.accounts
    const institutionId = accountsResponse.data.item.institution_id
    
    console.log(`📊 Found ${accounts.length} accounts from institution: ${institutionId}`)

    for (const account of accounts) {
      try {
        // Determine account type
        const accountType = account.subtype === 'savings' ? 'savings' : 
                           account.type === 'credit' ? 'liability' : 'checking'
        
        // Calculate balance (credit cards should be negative)
        const balance = account.type === 'credit' ? 
                       -Math.abs(account.balances.current || 0) : 
                       account.balances.current || 0

        // Create better account name
        let accountName = account.official_name || account.name
        
        if (accountName === 'Connected Account' || accountName === 'Account' || !accountName) {
          const cleanInstitutionId = institutionId?.replace('ins_', '') || 'Bank'
          const accountTypeDisplay = account.subtype === 'savings' ? 'Savings' : 
                                   account.subtype === 'checking' ? 'Checking' :
                                   account.type === 'credit' ? 'Credit Card' : 
                                   account.subtype || 'Account'
          accountName = `${cleanInstitutionId} ${accountTypeDisplay}`
        }

        console.log(`💰 Syncing: ${accountName} (${accountType}) = $${balance}`)
        console.log(`   Plaid Account ID: ${account.account_id}`)

        // Check if account already exists by plaid_account_id
        const { data: existingAccounts } = await supabase
          .from('account_balances')
          .select('id')
          .eq('user_id', userId)
          .eq('plaid_account_id', account.account_id)
          .limit(1)

        let result
        if (existingAccounts && existingAccounts.length > 0) {
          // Update existing account
          console.log(`🔄 Updating existing account: ${accountName}`)
          result = await supabase
            .from('account_balances')
            .update({
              account_name: accountName,
              account_type: accountType,
              balance: balance,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingAccounts[0].id)
            .select()
        } else {
          // Insert new account
          console.log(`➕ Inserting new account: ${accountName}`)
          result = await supabase
            .from('account_balances')
            .insert({
              user_id: userId,
              account_name: accountName,
              account_type: accountType,
              balance: balance,
              plaid_account_id: account.account_id,
              updated_at: new Date().toISOString(),
            })
            .select()
        }

        const { data, error } = result

        if (error) {
          console.error(`❌ Error syncing account ${accountName}:`, error)
          errors.push(`Failed to sync ${accountName}: ${error.message}`)
        } else {
          console.log(`✅ Successfully synced ${accountName}`)
          syncedAccounts++

          // Record a daily balance snapshot for historical net worth tracking
          const today = new Date().toISOString().split('T')[0]
          await supabase
            .from('balance_snapshots')
            .upsert({
              user_id: userId,
              snapshot_date: today,
              account_name: accountName,
              account_type: accountType,
              balance: balance,
              plaid_account_id: account.account_id,
            }, {
              onConflict: 'idx_balance_snapshots_unique',
            })
        }

      } catch (accountError) {
        console.error(`❌ Error processing account ${account.account_id}:`, accountError)
        errors.push(`Failed to process account: ${accountError instanceof Error ? accountError.message : 'Unknown error'}`)
      }
    }

    return {
      success: errors.length === 0,
      syncedAccounts,
      errors
    }

  } catch (error) {
    console.error('❌ Balance sync failed:', error)
    return {
      success: false,
      syncedAccounts: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }
  }
}
