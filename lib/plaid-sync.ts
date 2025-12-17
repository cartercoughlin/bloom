import { plaidClient } from './plaid'
import { createClient } from '@/lib/supabase/server'
import {
  TransactionsGetRequest,
  AccountsGetRequest,
  TransactionsGetResponse,
  AccountsGetResponse,
  InstitutionsGetByIdRequest
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
    const institutionId = accountsResponse.data.item.institution_id
    const itemId = accountsResponse.data.item.item_id
    console.log('Found accounts:', accounts.length)
    console.log('Institution ID:', institutionId)

    // Get proper institution name from Plaid
    let institutionName = institutionId
    try {
      const institutionRequest: InstitutionsGetByIdRequest = {
        institution_id: institutionId,
        country_codes: ['US'],
      }
      const institutionResponse = await plaidClient.institutionsGetById(institutionRequest)
      institutionName = institutionResponse.data.institution.name
      console.log('Institution name:', institutionName)

      // Update plaid_items with correct institution name
      await supabase
        .from('plaid_items')
        .update({ institution_name: institutionName })
        .eq('user_id', user.id)
        .eq('access_token', accessToken)
    } catch (error) {
      console.error('Failed to get/update institution name:', error)
      // Use fallback naming
      institutionName = institutionId?.replace('ins_', '').replace(/_/g, ' ').split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ') || 'Bank'
    }

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
      const result = await syncTransactionsForAccounts(accessToken, accounts, user.id, syncedAccountsCount, institutionName)
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

// Helper function to normalize descriptions for better duplicate detection
function normalizeDescription(description: string): string {
  return description
    .toLowerCase()
    .trim()
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Remove common special characters that might vary between transactions
    .replace(/[^\w\s]/g, '')
    // Trim again after replacements
    .trim()
}

// Helper function to extract merchant name (first part before location/extra info)
function getMerchantPrefix(description: string): string {
  const normalized = normalizeDescription(description)
  // Take first 3 words as merchant identifier (handles most cases)
  const words = normalized.split(' ')
  return words.slice(0, Math.min(3, words.length)).join(' ')
}

async function syncTransactionsForAccounts(accessToken: string, accounts: any[], userId: string, syncedAccountsCount: number, institutionName: string): Promise<SyncResult> {
  const supabase = await createClient()

  // Get existing categories
  const { data: categories } = await supabase.from('categories').select('id, name').eq('user_id', userId)
  const categoryMap = new Map(categories?.map(c => [c.name.toLowerCase(), c.id]) || [])

  // Get existing transactions from last 90 days to avoid duplicates
  // Extended to 90 days to catch older categorized transactions
  const lookbackDate = new Date()
  lookbackDate.setDate(lookbackDate.getDate() - 90)

  const { data: existingTransactions } = await supabase
    .from('transactions')
    .select('id, plaid_transaction_id, date, description, amount, bank')
    .eq('user_id', userId)
    .gte('date', lookbackDate.toISOString().split('T')[0])

  // Create multiple lookup maps for robust deduplication
  const existingByPlaidId = new Map<string, any>()
  const existingByFingerprint = new Map<string, any>()
  const existingByNormalizedFingerprint = new Map<string, any>()
  const existingByMerchantPrefix = new Map<string, any>()

  existingTransactions?.forEach(t => {
    // Plaid ID lookup (primary)
    if (t.plaid_transaction_id) {
      existingByPlaidId.set(t.plaid_transaction_id, t)
    }

    // Exact fingerprint lookup (fallback #1) - date + description + amount + bank
    const fingerprint = `${t.date}_${t.description.toLowerCase().trim()}_${t.amount}_${t.bank}`
    existingByFingerprint.set(fingerprint, t)

    // Normalized fingerprint lookup (fallback #2) - handles variations in spacing and special characters
    const normalizedFingerprint = `${t.date}_${normalizeDescription(t.description)}_${t.amount}_${t.bank.toLowerCase().trim()}`
    existingByNormalizedFingerprint.set(normalizedFingerprint, t)

    // Merchant prefix lookup (fallback #3) - handles pending→posted with location changes
    // Uses first 3 words of merchant name to match despite different suffixes
    const merchantFingerprint = `${t.date}_${getMerchantPrefix(t.description)}_${t.amount}_${t.bank.toLowerCase().trim()}`
    existingByMerchantPrefix.set(merchantFingerprint, t)
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
      // Use the institution name we already fetched
      bankName = institutionName || 'Bank'
    }

    // Create transaction fingerprints for deduplication
    const fingerprint = `${transaction.date}_${transaction.name.toLowerCase().trim()}_${Math.abs(transaction.amount)}_${bankName}`
    const normalizedFingerprint = `${transaction.date}_${normalizeDescription(transaction.name)}_${Math.abs(transaction.amount)}_${bankName.toLowerCase().trim()}`

    // Check for existing transaction using multiple methods
    let existingTransaction = null

    // Method 0: Check by pending_transaction_id (OFFICIAL Plaid way for pending→posted)
    // When a pending transaction posts, Plaid sends it with pending_transaction_id pointing to the original
    if (transaction.pending_transaction_id) {
      console.log(`Transaction has pending_transaction_id: ${transaction.pending_transaction_id}, will update existing pending transaction`)
      existingTransaction = existingByPlaidId.get(transaction.pending_transaction_id)

      // If not in cache, check database
      if (!existingTransaction) {
        const { data: dbMatch } = await supabase
          .from('transactions')
          .select('id, plaid_transaction_id, date, description, amount, bank')
          .eq('user_id', userId)
          .eq('plaid_transaction_id', transaction.pending_transaction_id)
          .limit(1)
          .single()

        if (dbMatch) {
          existingTransaction = dbMatch
          console.log(`Found pending transaction ${transaction.pending_transaction_id}, will update to posted`)
        }
      }
    }

    // Method 1: Check by Plaid transaction ID (most reliable)
    if (!existingTransaction && transaction.transaction_id) {
      existingTransaction = existingByPlaidId.get(transaction.transaction_id)

      // If not in cache, check database directly for plaid_transaction_id
      // This catches transactions older than the lookback period
      if (!existingTransaction) {
        const { data: dbMatch } = await supabase
          .from('transactions')
          .select('id, plaid_transaction_id, date, description, amount, bank')
          .eq('user_id', userId)
          .eq('plaid_transaction_id', transaction.transaction_id)
          .limit(1)
          .single()

        if (dbMatch) {
          existingTransaction = dbMatch
          // Add to cache for future lookups in this batch
          existingByPlaidId.set(transaction.transaction_id, dbMatch)
        }
      }
    }

    // Method 2: Check by exact fingerprint (fallback for duplicate detection)
    if (!existingTransaction) {
      existingTransaction = existingByFingerprint.get(fingerprint)
    }

    // Method 3: Check by normalized fingerprint (handles variations in spacing and special characters)
    if (!existingTransaction) {
      existingTransaction = existingByNormalizedFingerprint.get(normalizedFingerprint)
    }

    // Method 4: Check by merchant prefix (handles pending→posted with location/phone number changes)
    if (!existingTransaction) {
      const merchantFingerprint = `${transaction.date}_${getMerchantPrefix(transaction.name)}_${Math.abs(transaction.amount)}_${bankName.toLowerCase().trim()}`
      existingTransaction = existingByMerchantPrefix.get(merchantFingerprint)
    }

    if (existingTransaction) {
      // If this is a pending→posted update (has pending_transaction_id), update the existing transaction
      if (transaction.pending_transaction_id) {
        console.log(`Updating pending transaction ${transaction.pending_transaction_id} to posted with ID ${transaction.transaction_id}`)
        await supabase
          .from('transactions')
          .update({
            plaid_transaction_id: transaction.transaction_id, // Update to posted ID
            description: transaction.original_description || transaction.name, // Update with final description
            amount: Math.abs(transaction.amount), // Update with final amount
            date: transaction.date, // Update with final date
          })
          .eq('id', existingTransaction.id)
        updatedCount++
      }
      // If existing transaction doesn't have Plaid ID, backfill it
      else if (!existingTransaction.plaid_transaction_id && transaction.transaction_id) {
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
      // Use original_description when available (full bank description),
      // otherwise fall back to cleaned name
      description: transaction.original_description || transaction.name,
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
    const { data: insertedData, error: insertError } = await supabase.from('transactions').insert(transactionData).select('id')

    if (insertError) {
      console.error('Transaction insert error:', insertError)
    } else {
      newCount++
      console.log('Successfully inserted transaction')

      // Add to lookup maps to prevent duplicates within this sync batch
      const newTransaction = {
        id: insertedData?.[0]?.id,
        plaid_transaction_id: transaction.transaction_id,
        date: transaction.date,
        description: transactionData.description,
        amount: transactionData.amount,
        bank: bankName
      }

      if (transaction.transaction_id) {
        existingByPlaidId.set(transaction.transaction_id, newTransaction)
      }
      existingByFingerprint.set(fingerprint, newTransaction)
      existingByNormalizedFingerprint.set(normalizedFingerprint, newTransaction)

      // Add merchant prefix fingerprint for pending→posted duplicate detection
      const merchantFingerprint = `${transaction.date}_${getMerchantPrefix(transaction.name)}_${Math.abs(transaction.amount)}_${bankName.toLowerCase().trim()}`
      existingByMerchantPrefix.set(merchantFingerprint, newTransaction)
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
