import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { plaidClient } from '@/lib/plaid'

// Force dynamic rendering - don't cache
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch plaid items
    const { data: plaidItems, error: itemsError } = await supabase
      .from('plaid_items')
      .select('id, item_id, account_name, institution_name, sync_transactions, sync_balances, created_at, updated_at, access_token')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (itemsError) {
      console.error('Database error:', itemsError)
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
    }

    // Fetch all account balances
    const { data: allBalances } = await supabase
      .from('account_balances')
      .select('balance, plaid_account_id, updated_at')
      .eq('user_id', user.id)
      .not('plaid_account_id', 'is', null)

    // Build response with balance info for each plaid item
    const accountsWithBalances = await Promise.all(
      (plaidItems || []).map(async (item) => {
        let totalBalance = 0
        let accountCount = 0
        let lastBalanceUpdate: string | null = null

        try {
          // Get account IDs from Plaid API
          const response = await plaidClient.accountsGet({ access_token: item.access_token })
          const accountIds = response.data.accounts.map(acc => acc.account_id)

          // Filter balances that belong to this plaid item
          const itemBalances = (allBalances || []).filter(
            bal => bal.plaid_account_id && accountIds.includes(bal.plaid_account_id)
          )

          totalBalance = itemBalances.reduce((sum, bal) => sum + Number(bal.balance), 0)
          accountCount = itemBalances.length

          // Get the most recent balance update
          if (itemBalances.length > 0) {
            lastBalanceUpdate = itemBalances
              .map(b => b.updated_at)
              .sort()
              .reverse()[0]
          }
        } catch (err) {
          console.error(`Error fetching accounts for ${item.institution_name}:`, err)
        }

        return {
          id: item.id,
          item_id: item.item_id,
          account_name: item.account_name,
          institution_name: item.institution_name,
          sync_transactions: item.sync_transactions,
          sync_balances: item.sync_balances,
          created_at: item.created_at,
          updated_at: item.updated_at,
          total_balance: totalBalance,
          account_count: accountCount,
          last_balance_update: lastBalanceUpdate
        }
      })
    )

    return NextResponse.json(accountsWithBalances)
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
