/**
 * Calculate Historical Recurring Expenses
 *
 * Looks at the past N complete months to calculate average recurring expenses
 * per category. This is used for more accurate pacing calculations.
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface HistoricalRecurringData {
  // Average recurring expenses per category
  byCategory: Record<string, number>
  // Total average recurring across all budgeted categories
  total: number
  // Number of months used in the calculation
  monthsUsed: number
}

/**
 * Calculate the average monthly recurring expenses from prior complete months.
 *
 * @param supabase - Supabase client
 * @param userId - User ID
 * @param currentMonth - Current month (1-12)
 * @param currentYear - Current year
 * @param budgetCategoryIds - Array of category IDs that have budgets (to filter results)
 * @param monthsToLookBack - Number of months to look back (default 3)
 * @returns Historical recurring data with averages per category
 */
export async function calculateHistoricalRecurring(
  supabase: SupabaseClient,
  userId: string,
  currentMonth: number,
  currentYear: number,
  budgetCategoryIds: string[],
  monthsToLookBack: number = 3
): Promise<HistoricalRecurringData> {
  // Build list of prior complete months to query
  const monthsToQuery: Array<{ month: number; year: number }> = []

  let month = currentMonth
  let year = currentYear

  for (let i = 0; i < monthsToLookBack; i++) {
    // Go back one month
    month = month === 1 ? 12 : month - 1
    year = month === 12 ? year - 1 : year

    monthsToQuery.push({ month, year })
  }

  if (monthsToQuery.length === 0) {
    return { byCategory: {}, total: 0, monthsUsed: 0 }
  }

  // Query recurring transactions for all prior months at once
  // Build date ranges for each month
  const dateRanges = monthsToQuery.map(({ month, year }) => {
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const nextMonthFirstDay = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
    return { firstDay, nextMonthFirstDay, month, year }
  })

  // Query all recurring transactions in the date range
  const oldestDate = dateRanges[dateRanges.length - 1].firstDay
  const newestDate = dateRanges[0].nextMonthFirstDay

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('category_id, amount, transaction_type, date, hidden')
    .eq('user_id', userId)
    .eq('recurring', true)
    .gte('date', oldestDate)
    .lt('date', newestDate)
    .not('deleted', 'eq', true)

  if (error) {
    console.error('Error fetching historical recurring transactions:', error)
    return { byCategory: {}, total: 0, monthsUsed: 0 }
  }

  // Track which months actually have data
  const monthsWithData = new Set<string>()

  // Aggregate recurring expenses by category and month
  // Structure: { categoryId: { "2024-01": amount, "2024-02": amount, ... } }
  const recurringByMonthAndCategory: Record<string, Record<string, number>> = {}

  transactions?.forEach((tx: any) => {
    if (tx.hidden || !tx.category_id) return

    // Only count debit transactions as recurring expenses
    // Credits would be recurring income, not expenses
    if (tx.transaction_type !== 'debit') return

    // Determine which month this transaction belongs to
    const txDate = new Date(tx.date)
    const txMonth = txDate.getMonth() + 1
    const txYear = txDate.getFullYear()
    const monthKey = `${txYear}-${String(txMonth).padStart(2, '0')}`

    monthsWithData.add(monthKey)

    if (!recurringByMonthAndCategory[tx.category_id]) {
      recurringByMonthAndCategory[tx.category_id] = {}
    }

    if (!recurringByMonthAndCategory[tx.category_id][monthKey]) {
      recurringByMonthAndCategory[tx.category_id][monthKey] = 0
    }

    recurringByMonthAndCategory[tx.category_id][monthKey] += Number(tx.amount)
  })

  // Calculate averages per category
  // Only average over months that actually have transaction data
  const monthsUsed = monthsWithData.size

  if (monthsUsed === 0) {
    return { byCategory: {}, total: 0, monthsUsed: 0 }
  }

  const averageByCategory: Record<string, number> = {}
  let totalAverage = 0

  // Only include categories that have budgets
  const budgetCategorySet = new Set(budgetCategoryIds)

  Object.entries(recurringByMonthAndCategory).forEach(([categoryId, monthlyAmounts]) => {
    // Only include if this category has a budget
    if (!budgetCategorySet.has(categoryId)) return

    // Sum all months and divide by number of months with data
    const totalForCategory = Object.values(monthlyAmounts).reduce((sum, amt) => sum + amt, 0)
    const average = totalForCategory / monthsUsed

    averageByCategory[categoryId] = average
    totalAverage += average
  })

  return {
    byCategory: averageByCategory,
    total: totalAverage,
    monthsUsed
  }
}
