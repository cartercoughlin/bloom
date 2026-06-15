import { SupabaseClient } from '@supabase/supabase-js'

export async function calculateRolloverEfficient(
  supabase: SupabaseClient,
  userId: string,
  month: number,
  year: number
): Promise<Record<string, number>> {
  const dateEnd = `${year}-${String(month).padStart(2, '0')}-01`

  // Build 12-month lookback window for regular rollover categories
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
  const yearsInRange = [...new Set(months.map((m) => m.year))]

  const [budgetsResult, transactionsResult, categoriesResult] = await Promise.all([
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
    supabase
      .from('categories')
      .select('id, is_rollover')
      .eq('user_id', userId),
  ])

  const allBudgets = budgetsResult.data || []
  const allTransactions = transactionsResult.data || []

  // Savings goals use the bank account model with FULL history (not the 12-month window)
  const savingsGoalCategoryIds = new Set(
    (categoriesResult.data || []).filter((c: any) => c.is_rollover).map((c: any) => c.id)
  )

  // Index budgets by month for the regular forward-pass
  const budgetsByMonth: Record<string, typeof allBudgets> = {}
  for (const b of allBudgets) {
    const key = `${b.year}-${b.month}`
    if (!budgetsByMonth[key]) budgetsByMonth[key] = []
    budgetsByMonth[key].push(b)
  }

  // Compute spending per category per month for the regular forward-pass
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

  // Forward-pass rollover for regular (non-savings-goal) categories only
  let rollover: Record<string, number> = {}

  for (const { month: m, year: y } of months) {
    const key = `${y}-${m}`
    const monthBudgets = budgetsByMonth[key] || []
    const monthSpending = spendingByMonth[key] || {}

    const rolloverEnabledCategories = monthBudgets
      .filter((b: any) => !savingsGoalCategoryIds.has(b.category_id) && b.enable_rollover !== false)
      .map((b: any) => b.category_id)

    const rolloverCategories = new Set([
      ...rolloverEnabledCategories,
      ...Object.keys(rollover),
    ])

    const nextRollover: Record<string, number> = {}

    for (const catId of rolloverCategories) {
      if (savingsGoalCategoryIds.has(catId)) continue
      const budget = monthBudgets.find((b: any) => b.category_id === catId)
      const rolloverEnabled = budget ? budget.enable_rollover !== false : true
      if (!rolloverEnabled) continue

      const budgetAmount = budget?.amount ? Number(budget.amount) : 0
      const spent = Math.max(0, monthSpending[catId] || 0)
      const prevRollover = rollover[catId] || 0
      const remaining = budgetAmount + prevRollover - spent

      if (remaining > 0) {
        nextRollover[catId] = remaining
      }
    }

    rollover = nextRollover
  }

  // Bank account model for savings goals: sum ALL history including the current month.
  // This way the returned balance is always the live total — no need for the UI to add
  // the current month's allocation separately.
  if (savingsGoalCategoryIds.size > 0) {
    const catIdsArray = [...savingsGoalCategoryIds]

    // End of the CURRENT month (first day of next month)
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const savingsDateEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

    const [savingsBudgetsResult, savingsTransactionsResult] = await Promise.all([
      supabase
        .from('budgets')
        .select('category_id, amount, month, year')
        .eq('user_id', userId)
        .in('category_id', catIdsArray),
      supabase
        .from('transactions')
        .select('category_id, amount, transaction_type, hidden, date')
        .eq('user_id', userId)
        .in('category_id', catIdsArray)
        .lt('date', savingsDateEnd)
        .not('deleted', 'eq', true),
    ])

    for (const catId of savingsGoalCategoryIds) {
      // Sum all budget contributions up to and including the current month
      const totalContributions = (savingsBudgetsResult.data || [])
        .filter((b: any) => {
          if (b.category_id !== catId) return false
          const bYear = Number(b.year)
          const bMonth = Number(b.month)
          return bYear < year || (bYear === year && bMonth <= month)
        })
        .reduce((sum: number, b: any) => sum + (Number(b.amount) || 0), 0)

      // Sum all spending up to end of the current month
      let totalSpending = 0
      for (const tx of (savingsTransactionsResult.data || [])) {
        if (tx.category_id !== catId || tx.hidden) continue
        if (tx.transaction_type === 'debit') {
          totalSpending += Number(tx.amount)
        } else if (tx.transaction_type === 'credit') {
          totalSpending -= Number(tx.amount)
        }
      }

      rollover[catId] = totalContributions - totalSpending
    }
  }

  return rollover
}
