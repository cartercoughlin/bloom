import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Show the user's name for an account when they've set one; keep the bank's
// name as original_name (sync keeps updating account_name from Plaid)
function withDisplayName<T extends { account_name: string; custom_name?: string | null }>(acc: T) {
  return { ...acc, original_name: acc.account_name, account_name: acc.custom_name || acc.account_name }
}

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all accounts
    const { data: accounts, error } = await supabase
      .from('account_balances')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
    }

    // Filter accounts based on sync settings
    // Manual accounts (no plaid_account_id) should always be shown
    // Plaid accounts should only be shown if they're from a connection with sync_balances enabled
    if (accounts && accounts.length > 0) {
      const plaidAccountIds = accounts
        .filter(acc => acc.plaid_account_id)
        .map(acc => acc.plaid_account_id)

      if (plaidAccountIds.length > 0) {
        // Get Plaid items and their sync settings
        const { data: plaidItems } = await supabase
          .from('plaid_items')
          .select('access_token, sync_balances')
          .eq('user_id', user.id)

        if (plaidItems && plaidItems.length > 0) {
          // Build a set of account IDs from items with sync_balances enabled
          const { plaidClient } = await import('@/lib/plaid')
          const activeAccountIds = new Set<string>()

          for (const item of plaidItems.filter(i => i.sync_balances)) {
            try {
              const response = await plaidClient.accountsGet({ access_token: item.access_token })
              response.data.accounts.forEach(acc => activeAccountIds.add(acc.account_id))
            } catch (err) {
              console.error('Error fetching accounts for filtering:', err)
              // Continue to show existing accounts even if API call fails
            }
          }

          // Filter accounts: include manual accounts and plaid accounts from synced connections
          // If we couldn't fetch active accounts from Plaid API, include all accounts from DB
          // This prevents accounts from disappearing if there's a temporary API issue
          const filteredAccounts = accounts.filter(acc => {
            if (!acc.plaid_account_id) {
              // Always include manual accounts
              return true
            }

            // For Plaid accounts, include if:
            // 1. They're in the active account IDs from Plaid API
            // 2. OR we have any Plaid items with sync enabled (to handle API failures)
            return activeAccountIds.size === 0 ?
              plaidItems.some(i => i.sync_balances) :
              activeAccountIds.has(acc.plaid_account_id)
          })

          return NextResponse.json(filteredAccounts.map(withDisplayName))
        }
      }
    }

    // If no plaid accounts, just return all accounts (manual ones)
    return NextResponse.json((accounts?.filter(acc => !acc.plaid_account_id) || []).map(withDisplayName))
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { account_name, account_type, balance } = await request.json()

    const { data: account, error } = await supabase
      .from('account_balances')
      .insert({
        user_id: user.id,
        account_name,
        account_type,
        balance: parseFloat(balance)
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
    }

    return NextResponse.json(account)
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
