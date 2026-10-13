// Daily per-account balance snapshots that power the net worth chart.

interface SnapshotInput {
  userId: string
  accountName: string
  accountType: string
  balance: number
  plaidAccountId: string
}

// One snapshot per account per day. The table's unique index is on an
// expression (COALESCE(plaid_account_id, account_name)), which upsert's
// onConflict can't target, so replace today's row explicitly.
export async function recordBalanceSnapshot(supabase: any, s: SnapshotInput) {
  const today = new Date().toISOString().split('T')[0]

  const { error: deleteError } = await supabase
    .from('balance_snapshots')
    .delete()
    .eq('user_id', s.userId)
    .eq('snapshot_date', today)
    .eq('plaid_account_id', s.plaidAccountId)
  if (deleteError) {
    console.error('Balance snapshot cleanup error:', deleteError)
    return
  }

  const { error } = await supabase.from('balance_snapshots').insert({
    user_id: s.userId,
    snapshot_date: today,
    account_name: s.accountName,
    account_type: s.accountType,
    balance: s.balance,
    plaid_account_id: s.plaidAccountId,
  })
  if (error) console.error('Balance snapshot save error:', error)
}
