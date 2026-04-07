import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Efficient rollover calculation using only 2 DB queries.
 * Looks back up to 12 months and forward-accumulates rollover.
 */
export async function calculateRolloverEfficient(
  supabase: SupabaseClient,
  userId: string,
  month: number,
  year: number
): Promise<Record<string, number>> {
  // Build 12-month lookback window
  const months: { month: number; year: number }[] = []
  let m = month
  let y = year
  for (let i = 0; i < 12; i++) {
    m = m === 1 ? 12 : m - 1
    y = m === 12 ? y - 1 : y
    months.unshift({ month: m, year: y })
  }

  const oldest = months[0]
  const dateStart = `${oldest.year}-${String(oldest.month).padStart(2, '0')}-01`
  const dateEnd = `${year}-${String(month).padStart(2, '0')}-01`
  const yearsInRange = [...new Set(months.map((m) => m.year))]

  // 2 parallel queries instead of 12+ recursive ones
  const [budgetsResult, transactionsResult] = await Promise.all([
    supabase
      .from('budgets')
      .select('category_id, amount, enable_rollover, month, year')
      .eq('user_id', userId)
      .in('year', yearsInRange),
    supabase
      .from('transactions')
      .select('category_id, amount, transaction_type, hidden, date')
      .eq('user_id', userId)
      .gte('date', dateStart)
      .lt('date', dateEnd)
      .not('deleted', 'eq', true),
  ])

  const allBudgets = budgetsResult.data || []
  const allTransactions = transactionsResult.data || []

  // Index budgets by month
  const budgetsByMonth: Record<string, typeof allBudgets> = {}
  for (const b of allBudgets) {
    const key = `${b.year}-${b.month}`
    if (!budgetsByMonth[key]) budgetsByMonth[key] = []
    budgetsByMonth[key].push(b)
  }

  // Compute spending per category per month
  const spendingByMonth: Record<string, Record<string, number>> = {}
  for (const tx of allTransactions) {
    if (tx.hidden || !tx.category_id) continue
    const d = new Date(tx.date)
    const txMonth = d.getUTCMonth() + 1
    const txYear = d.getUTCFullYear()
    const key = `${txYear}-${txMonth}`

    if (!spendingByMonth[key]) spendingByMonth[key] = {}
    if (!spendingByMonth[key][tx.category_id]) spendingByMonth[key][tx.category_id] = 0

    if (tx.transaction_type === 'debit') {
      spendingByMonth[key][tx.category_id] += Number(tx.amount)
    } else if (tx.transaction_type === 'credit') {
      spendingByMonth[key][tx.category_id] -= Number(tx.amount)
    }
  }

  // Forward pass accumulation
  let rollover: Record<string, number> = {}

  for (const { month: m, year: y } of months) {
    const key = `${y}-${m}`
    const monthBudgets = budgetsByMonth[key] || []
    const monthSpending = spendingByMonth[key] || {}

    const rolloverEnabledCategories = monthBudgets
      .filter((b: any) => b.enable_rollover !== false)
      .map((b: any) => b.category_id)

    const rolloverCategories = new Set([
      ...rolloverEnabledCategories,
      ...Object.keys(rollover),
    ])

    const nextRollover: Record<string, number> = {}

    for (const catId of rolloverCategories) {
      const budget = monthBudgets.find((b: any) => b.category_id === catId)
      const rolloverEnabled = budget ? budget.enable_rollover !== false : true
      if (!rolloverEnabled) continue

      const budgetAmount = budget?.amount ? Number(budget.amount) : 0
      const spent = monthSpending[catId] || 0
      const prevRollover = rollover[catId] || 0
      const remaining = Number(budgetAmount) + prevRollover - spent

      if (remaining !== 0) {
        nextRollover[catId] = remaining
      }
    }

    rollover = nextRollover
  }

  return rollover
}
