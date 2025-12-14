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

    // Get accounts
    console.log('Getting accounts for access token...')
    const accountsRequest: AccountsGetRequest = {
      access_token: accessToken,
    }
    const accountsResponse: AccountsGetResponse = await plaidClient.accountsGet(accountsRequest)
    const accounts = accountsResponse.data.accounts
    console.log('Found accounts:', accounts.length)

    // Sync account balances only if enabled
    let syncedAccountsCount = 0
    if (syncBalances) {
      console.log('Syncing account balances...')
      for (const account of accounts) {
        const accountType = account.subtype === 'savings' ? 'savings' : 
                           account.type === 'credit' ? 'liability' : 'checking'
        
        const balance = account.type === 'credit' ? 
                       -Math.abs(account.balances.current || 0) : 
                       account.balances.current || 0

        // Use the actual account name from Plaid, not the generic type
        const accountName = account.official_name || account.name

        console.log('Syncing account:', accountName, 'Balance:', balance)

        const { error: upsertError } = await supabase
          .from('account_balances')
          .upsert({
            user_id: user.id,
            account_name: accountName,
            account_type: accountType,
            balance: balance,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,account_name'
          })

        if (!upsertError) {
          syncedAccountsCount++
        }
      }
    } else {
      console.log('Balance sync disabled for this account')
    }

    // Sync transactions only if enabled
    if (syncTransactions) {
      console.log('Syncing transactions...')
      return await syncTransactionsForAccounts(accessToken, accounts, user.id, syncedAccountsCount)
    } else {
      console.log('Transaction sync disabled for this account')
      return {
        success: true,
        newTransactions: 0,
        updatedTransactions: 0,
        totalProcessed: 0,
        syncedAccounts: syncedAccountsCount,
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
  
  // Get existing categories
  const { data: categories } = await supabase.from('categories').select('id, name').eq('user_id', userId)
  const categoryMap = new Map(categories?.map(c => [c.name.toLowerCase(), c.id]) || [])

  // Get existing transactions to avoid duplicates
  const { data: existingTransactions } = await supabase
    .from('transactions')
    .select('id, description, date, amount')
    .eq('user_id', userId)

  const existingKeys = new Set(existingTransactions?.map(t => `${t.date}-${t.description}-${t.amount}`) || [])

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
    console.log('Processing transaction:', transaction.name, transaction.amount, transaction.date)
    const account = accounts.find(acc => acc.account_id === transaction.account_id)
    const bankName = account?.name || 'Unknown'
    
    const transactionKey = `${transaction.date}-${transaction.name}-${Math.abs(transaction.amount)}`
    
    if (existingKeys.has(transactionKey)) {
      updatedCount++
      continue
    }

    // Skip categorization for now to avoid loops
    let categoryId = null

    const transactionData = {
      user_id: userId,
      date: transaction.date,
      description: transaction.name,
      amount: Math.abs(transaction.amount),
      transaction_type: transaction.amount > 0 ? 'debit' : 'credit',
      category_id: categoryId,
      bank: bankName,
      hidden: false,
      merchant_name: transaction.merchant_name || null,
      logo_url: transaction.logo_url || null,
      website: transaction.website || null,
      category_detailed: transaction.category?.join(' > ') || null,
    }

    console.log('Inserting transaction:', transactionData)
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
