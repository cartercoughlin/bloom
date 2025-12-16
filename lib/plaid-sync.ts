import { plaidClient } from './plaid'
import { createClient } from '@/lib/supabase/server'
import { 
  TransactionsGetRequest, 
  AccountsGetRequest,
  TransactionsGetResponse,
  AccountsGetResponse 
} from 'plaid'

export interface SyncResult {
  success: boolean
  newTransactions: number
  updatedTransactions: number
  totalProcessed: number
  syncedAccounts?: number
  accountIds?: string[]
  error?: string
}

export async function syncPlaidTransactions(accessToken: string, options?: { syncTransactions?: boolean; syncBalances?: boolean }): Promise<SyncResult> {
  try {
    if (!accessToken) {
      return {
        success: false,
        newTransactions: 0,
        updatedTransactions: 0,
        totalProcessed: 0,
        error: 'No access token provided'
      }
    }

    const { syncTransactions = true, syncBalances = true } = options || {}

    console.log('Starting Plaid sync with access token:', accessToken.substring(0, 10) + '...')
    console.log('Sync options:', { syncTransactions, syncBalances })
    
    const supabase = await createClient()
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return {
        success: false,
        newTransactions: 0,
        updatedTransactions: 0,
        totalProcessed: 0,
        error: 'User not authenticated'
      }
    }

    // Get accounts and institution info
    console.log('Getting accounts for access token...')
    const accountsRequest: AccountsGetRequest = {
      access_token: accessToken,
    }
    const accountsResponse: AccountsGetResponse = await plaidClient.accountsGet(accountsRequest)
    const accounts = accountsResponse.data.accounts
    const institutionName = accountsResponse.data.item.institution_id
    console.log('Found accounts:', accounts.length)

    // Sync account balances only if enabled
    let syncedAccountsCount = 0
    if (syncBalances) {
      console.log('Syncing account balances...')
      
      // Get current account IDs from this Plaid connection
      const currentAccountIds = accounts.map(acc => acc.account_id)
      
      for (const account of accounts) {
        console.log('Raw account data:', {
          account_id: account.account_id,
          name: account.name,
          official_name: account.official_name,
          type: account.type,
          subtype: account.subtype
        })

        const accountType = account.subtype === 'savings' ? 'savings' :
                           account.type === 'credit' ? 'liability' : 'checking'

        const balance = account.type === 'credit' ?
                       -Math.abs(account.balances.current || 0) :
                       account.balances.current || 0

        // Create better account name using institution and account details
        let accountName = account.official_name || account.name

        console.log('Initial account name from Plaid:', accountName)

        // If it's a generic name, use institution + account type
        // Check case-insensitively and trim whitespace
        const normalizedName = accountName?.trim().toLowerCase() || ''
        const isGenericName = !normalizedName ||
                              normalizedName === 'connected account' ||
                              normalizedName === 'account' ||
                              normalizedName === 'plaid account' ||
                              normalizedName === 'checking' ||
                              normalizedName === 'savings' ||
                              normalizedName === 'credit card'

        console.log('Is generic name?', isGenericName, 'Normalized:', normalizedName)

        if (isGenericName) {
          const institutionId = accountsResponse.data.item.institution_id
          const accountTypeDisplay = account.subtype === 'savings' ? 'Savings' :
                                   account.subtype === 'checking' ? 'Checking' :
                                   account.type === 'credit' ? 'Credit Card' :
                                   account.subtype || 'Account'
          // Clean up institution ID (remove ins_ prefix and capitalize)
          const cleanInstitutionId = institutionId?.replace('ins_', '').replace(/_/g, ' ').split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          ).join(' ') || 'Bank'
          accountName = `${cleanInstitutionId} ${accountTypeDisplay}`
          console.log('Using generated name:', accountName)
        }

        console.log('Final account name for sync:', accountName, 'Balance:', balance)

        // Check if account already exists
        const { data: existingAccounts } = await supabase
          .from('account_balances')
          .select('id')
          .eq('user_id', user.id)
          .eq('plaid_account_id', account.account_id)
          .limit(1)

        let result
        if (existingAccounts && existingAccounts.length > 0) {
          // Update existing account
          console.log('Updating existing account:', existingAccounts[0].id)
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
          console.log('Inserting new account')
          result = await supabase
            .from('account_balances')
            .insert({
              user_id: user.id,
              account_name: accountName,
              account_type: accountType,
              balance: balance,
              plaid_account_id: account.account_id,
              updated_at: new Date().toISOString(),
            })
            .select()
        }

        const { data, error: saveError } = result

        if (saveError) {
          console.error('❌ Account balance save error:', saveError)
        } else {
          console.log('✅ Successfully synced account balance:', {
            id: data?.[0]?.id,
            account_name: data?.[0]?.account_name,
            plaid_account_id: data?.[0]?.plaid_account_id,
            balance: data?.[0]?.balance
          })
          syncedAccountsCount++
        }
      }
      
      // Clean up accounts that no longer exist in this Plaid connection
      // This will be handled globally in the sync route
    } else {
      console.log('Balance sync disabled for this account')
    }

    // Sync transactions only if enabled
    if (syncTransactions) {
      console.log('Syncing transactions...')
      const result = await syncTransactionsForAccounts(accessToken, accounts, user.id, syncedAccountsCount)
      return {
        ...result,
        accountIds: accounts.map(acc => acc.account_id)
      }
    } else {
      console.log('Transaction sync disabled for this account')
      return {
        success: true,
        newTransactions: 0,
        updatedTransactions: 0,
        totalProcessed: 0,
        syncedAccounts: syncedAccountsCount,
        accountIds: accounts.map(acc => acc.account_id)
      }
    }
    
  } catch (error: any) {
    console.error('Plaid sync error:', error)
    
    // Log detailed error information
    if (error.response?.data) {
      console.error('Plaid API error details:', error.response.data)
    }
    
    return {
      success: false,
      newTransactions: 0,
      updatedTransactions: 0,
      totalProcessed: 0,
      error: error.response?.data?.error_message || error.message || 'Unknown error'
    }
  }
}

async function syncTransactionsForAccounts(accessToken: string, accounts: any[], userId: string, syncedAccountsCount: number): Promise<SyncResult> {
  const supabase = await createClient()
  
  // Get institution info for better bank names
  const accountsRequest: AccountsGetRequest = { access_token: accessToken }
  const accountsResponse: AccountsGetResponse = await plaidClient.accountsGet(accountsRequest)
  const institutionId = accountsResponse.data.item.institution_id
  
  // Get existing categories
  const { data: categories } = await supabase.from('categories').select('id, name').eq('user_id', userId)
  const categoryMap = new Map(categories?.map(c => [c.name.toLowerCase(), c.id]) || [])

  // Get existing transactions from last 35 days to avoid duplicates
  const lookbackDate = new Date()
  lookbackDate.setDate(lookbackDate.getDate() - 35)
  
  const { data: existingTransactions } = await supabase
    .from('transactions')
    .select('id, plaid_transaction_id, date, description, amount, bank')
    .eq('user_id', userId)
    .gte('date', lookbackDate.toISOString().split('T')[0])

  // Create multiple lookup maps for robust deduplication
  const existingByPlaidId = new Map<string, any>()
  const existingByFingerprint = new Map<string, any>()
  
  existingTransactions?.forEach(t => {
    // Plaid ID lookup (primary)
    if (t.plaid_transaction_id) {
      existingByPlaidId.set(t.plaid_transaction_id, t)
    }
    
    // Fingerprint lookup (fallback) - date + description + amount + bank
    const fingerprint = `${t.date}_${t.description.toLowerCase().trim()}_${t.amount}_${t.bank}`
    existingByFingerprint.set(fingerprint, t)
  })

  let newCount = 0
  let updatedCount = 0
  let processedCount = 0

  // Get transactions for last 30 days
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 30)
  const endDate = new Date()

  console.log('Fetching transactions from', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0])

  const transactionsRequest: TransactionsGetRequest = {
    access_token: accessToken,
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
  }

  console.log('Making Plaid transactions request...')
  const transactionsResponse: TransactionsGetResponse = await plaidClient.transactionsGet(transactionsRequest)
  const transactions = transactionsResponse.data.transactions
  console.log('Retrieved transactions:', transactions.length)
  console.log('Processing transactions...')

  for (const transaction of transactions) {
    console.log('Processing transaction:', transaction.name, transaction.amount, transaction.date, 'ID:', transaction.transaction_id)
    const account = accounts.find(acc => acc.account_id === transaction.account_id)

    // Create better bank name using same logic as balance sync
    let bankName = account?.official_name || account?.name || 'Unknown'

    // Check case-insensitively and trim whitespace
    const normalizedBankName = bankName?.trim().toLowerCase() || ''
    const isGenericName = !normalizedBankName ||
                          normalizedBankName === 'connected account' ||
                          normalizedBankName === 'account' ||
                          normalizedBankName === 'plaid account' ||
                          normalizedBankName === 'checking' ||
                          normalizedBankName === 'savings' ||
                          normalizedBankName === 'credit card' ||
                          normalizedBankName === 'unknown'

    if (isGenericName) {
      // Clean up institution ID (remove ins_ prefix and capitalize)
      bankName = institutionId?.replace('ins_', '').replace(/_/g, ' ').split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ') || 'Bank'
    }

    // Create transaction fingerprint for deduplication
    const fingerprint = `${transaction.date}_${transaction.name.toLowerCase().trim()}_${Math.abs(transaction.amount)}_${bankName}`
    
    // Check for existing transaction using multiple methods
    let existingTransaction = null
    
    // Method 1: Check by Plaid transaction ID (most reliable)
    if (transaction.transaction_id) {
      existingTransaction = existingByPlaidId.get(transaction.transaction_id)
    }
    
    // Method 2: Check by fingerprint (fallback for duplicate detection)
    if (!existingTransaction) {
      existingTransaction = existingByFingerprint.get(fingerprint)
    }
    
    if (existingTransaction) {
      // If existing transaction doesn't have Plaid ID, update it
      if (!existingTransaction.plaid_transaction_id && transaction.transaction_id) {
        console.log('Backfilling Plaid ID for existing transaction:', existingTransaction.id)
        await supabase
          .from('transactions')
          .update({ plaid_transaction_id: transaction.transaction_id })
          .eq('id', existingTransaction.id)
        updatedCount++
      } else {
        console.log('Transaction already exists, skipping:', existingTransaction.id)
      }
      processedCount++
      continue
    }

    // Create new transaction
    const transactionData = {
      user_id: userId,
      plaid_transaction_id: transaction.transaction_id,
      plaid_account_id: transaction.account_id,
      date: transaction.date,
      description: transaction.name,
      amount: Math.abs(transaction.amount),
      transaction_type: transaction.amount > 0 ? 'debit' : 'credit',
      category_id: null,
      bank: bankName,
      hidden: false,
      merchant_name: transaction.merchant_name || null,
      logo_url: transaction.logo_url || null,
      website: transaction.website || null,
      category_detailed: transaction.category?.join(' > ') || null,
    }

    console.log('Inserting new transaction:', transactionData)
    const { error: insertError } = await supabase.from('transactions').insert(transactionData)
    
    if (insertError) {
      console.error('Transaction insert error:', insertError)
    } else {
      newCount++
      console.log('Successfully inserted transaction')
    }
    processedCount++
  }

  // Update last sync timestamp
  await supabase.from('profiles').update({ last_sync_at: new Date().toISOString() }).eq('id', userId)

  return {
    success: true,
    newTransactions: newCount,
    updatedTransactions: updatedCount,
    totalProcessed: processedCount,
    syncedAccounts: syncedAccountsCount,
  }
}
