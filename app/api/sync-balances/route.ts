import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { syncAccountBalances } from '@/lib/plaid-sync-improved'

export async function POST() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's Plaid items with sync_balances enabled
    const { data: plaidItems, error: plaidError } = await supabase
      .from('plaid_items')
      .select('access_token, institution_name, sync_balances')
      .eq('user_id', user.id)
      .eq('sync_balances', true)

    if (plaidError) {
      console.error('Database error:', plaidError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!plaidItems || plaidItems.length === 0) {
      // Still revalidate in case accounts were removed
      revalidatePath('/dashboard')
      revalidatePath('/accounts')
      revalidatePath('/net-worth')

      return NextResponse.json({
        success: true,
        message: 'No accounts configured for balance sync',
        syncedAccounts: 0
      })
    }

    let totalSyncedAccounts = 0
    const errors: string[] = []

    // Sync balances for each Plaid item
    for (const item of plaidItems) {
      try {
        console.log(`Syncing balances for ${item.institution_name}...`)
        const result = await syncAccountBalances(item.access_token, user.id)

        if (result.success) {
          totalSyncedAccounts += result.syncedAccounts
          console.log(`✅ Synced ${result.syncedAccounts} accounts from ${item.institution_name}`)
        } else {
          console.error(`❌ Failed to sync ${item.institution_name}:`, result.errors)
          errors.push(...result.errors)
        }
      } catch (itemError) {
        console.error(`Error syncing ${item.institution_name}:`, itemError)
        errors.push(`Failed to sync ${item.institution_name}: ${itemError instanceof Error ? itemError.message : 'Unknown error'}`)
      }
    }

    // Revalidate pages that display balance data
    revalidatePath('/dashboard')
    revalidatePath('/accounts')
    revalidatePath('/net-worth')

    return NextResponse.json({
      success: errors.length === 0,
      syncedAccounts: totalSyncedAccounts,
      message: errors.length === 0
        ? `Successfully synced ${totalSyncedAccounts} accounts`
        : `Partial sync completed with ${errors.length} errors`,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Balance sync error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Balance sync failed'
    }, { status: 500 })
  }
}
