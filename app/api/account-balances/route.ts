import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    // Plaid accounts should only be shown if they're from an active connection with sync_balances enabled
    if (accounts && accounts.length > 0) {
      const plaidAccountIds = accounts
        .filter(acc => acc.plaid_account_id)
        .map(acc => acc.plaid_account_id)

      if (plaidAccountIds.length > 0) {
        // Get active plaid items with sync_balances enabled
        const { data: plaidItems } = await supabase
          .from('plaid_items')
          .select('access_token, sync_balances')
          .eq('user_id', user.id)
          .eq('sync_balances', true)

        // Get account IDs from active connections with sync enabled
        if (plaidItems && plaidItems.length > 0) {
          const { plaidClient } = await import('@/lib/plaid')
          const activeAccountIds = new Set<string>()

          for (const item of plaidItems) {
            try {
              const response = await plaidClient.accountsGet({ access_token: item.access_token })
              response.data.accounts.forEach(acc => activeAccountIds.add(acc.account_id))
            } catch (err) {
              console.error('Error fetching accounts for filtering:', err)
            }
          }

          // Filter accounts: include manual accounts and plaid accounts from active synced connections
          const filteredAccounts = accounts.filter(acc =>
            !acc.plaid_account_id || activeAccountIds.has(acc.plaid_account_id)
          )

          return NextResponse.json(filteredAccounts)
        }
      }
    }

    // If no plaid accounts or no active connections, just return all accounts (manual ones)
    return NextResponse.json(accounts?.filter(acc => !acc.plaid_account_id) || [])
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
