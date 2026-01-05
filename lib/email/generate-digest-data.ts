/**
 * Generate Budget Digest Data
 *
 * Aggregates all the data needed for the daily budget digest email
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface DigestData {
  userName: string
  date: string
  budgetProgress: {
    totalBudget: number
    totalSpent: number
    totalRemaining: number
    percentageUsed: number
    isOverBudget: boolean
    percentageThroughMonth: number
    expectedSpending: number
    pacingDifference: number
    isPacingOver: boolean
  }
  categoryBreakdown: Array<{
    categoryName: string
    categoryIcon: string
    categoryColor: string
    budgetAmount: number
    spent: number
    remaining: number
    percentageUsed: number
    rollover?: number
  }>
  recentTransactions: Array<{
    date: string
    description: string
    amount: number
    categoryName: string
    categoryIcon: string
    type: 'debit' | 'credit'
  }>
  daysRemainingInMonth: number
}

export async function generateDigestData(
  supabase: SupabaseClient,
  userId: string
): Promise<DigestData | null> {
  try {
    // Get current month/year
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Calculate days remaining in month
    const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate()
    const daysRemainingInMonth = lastDayOfMonth - now.getDate()

    // Date range for current month
    const firstDay = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear
    const nextMonthFirstDay = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

    // Date range for last 24 hours
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single()

    const userName = profile?.full_name || ''

    // Fetch budgets for current month
    const { data: budgets } = await supabase
      .from('budgets')
      .select(`
        id,
        amount,
        category_id,
        enable_rollover,
        categories (
          id,
          name,
          color,
          icon,
          is_rollover
        )
      `)
      .eq('user_id', userId)
      .eq('month', currentMonth)
      .eq('year', currentYear)

    // Filter out savings goals
    const regularBudgets = (budgets || []).filter(
      (b: any) => !b.categories?.is_rollover
    )

    if (!regularBudgets || regularBudgets.length === 0) {
      return null // No budgets set up
    }

    // Fetch current month transactions
    const { data: transactions } = await supabase
      .from('transactions')
      .select(`
        id,
        amount,
        description,
        date,
        category_id,
        transaction_type,
        recurring,
        hidden,
        categories (
          name,
          color,
          icon
        )
      `)
      .eq('user_id', userId)
      .gte('date', firstDay)
      .lt('date', nextMonthFirstDay)
      .not('deleted', 'eq', true)
      .order('date', { ascending: false })

    // Calculate rollover from previous month
    const rollover = await calculateRollover(supabase, userId, currentMonth, currentYear)

    // Calculate spending by category
    const spendingByCategory: Record<string, { spent: number; income: number }> = {}
    transactions?.forEach((tx: any) => {
      if (tx.hidden || !tx.category_id) return

      if (!spendingByCategory[tx.category_id]) {
        spendingByCategory[tx.category_id] = { spent: 0, income: 0 }
      }

      if (tx.transaction_type === 'debit') {
        spendingByCategory[tx.category_id].spent += Number(tx.amount)
      } else if (tx.transaction_type === 'credit') {
        spendingByCategory[tx.category_id].income += Number(tx.amount)
      }
    })

    // Build category breakdown
    const categoryBreakdown = regularBudgets.map((budget: any) => {
      const categoryData = spendingByCategory[budget.category_id] || { spent: 0, income: 0 }
      const spent = Math.max(0, categoryData.spent - categoryData.income)
      const budgetAmount = Number(budget.amount)
      const rolloverAmount = rollover[budget.category_id] || 0
      const totalBudget = budget.enable_rollover !== false ? budgetAmount + rolloverAmount : budgetAmount
      const remaining = totalBudget - spent
      const percentageUsed = totalBudget > 0 ? (spent / totalBudget) * 100 : 0

      return {
        categoryName: budget.categories?.name || 'Unknown',
        categoryIcon: budget.categories?.icon || '📁',
        categoryColor: budget.categories?.color || '#6b7280',
        budgetAmount: totalBudget,
        spent,
        remaining,
        percentageUsed,
        rollover: budget.enable_rollover !== false ? rolloverAmount : undefined
      }
    }).sort((a, b) => b.spent - a.spent) // Sort by highest spending first

    // Calculate total budget progress
    const totalBudget = categoryBreakdown.reduce((sum, cat) => sum + cat.budgetAmount, 0)
    const totalSpent = categoryBreakdown.reduce((sum, cat) => sum + cat.spent, 0)
    const totalRemaining = totalBudget - totalSpent
    const percentageUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0

    // Calculate pacing metrics
    const daysInMonth = lastDayOfMonth
    const daysElapsed = now.getDate()
    const percentageThroughMonth = (daysElapsed / daysInMonth) * 100
    const expectedSpending = totalBudget * (percentageThroughMonth / 100)
    const pacingDifference = totalSpent - expectedSpending
    const isPacingOver = pacingDifference > 0

    // Get recent transactions (last 24 hours)
    const recentTransactions = (transactions || [])
      .filter((tx: any) => !tx.hidden && tx.date >= yesterdayStr)
      .slice(0, 10) // Limit to 10 most recent
      .map((tx: any) => ({
        date: tx.date,
        description: tx.description || 'Untitled Transaction',
        amount: Number(tx.amount),
        categoryName: tx.categories?.name || 'Uncategorized',
        categoryIcon: tx.categories?.icon || '📁',
        type: tx.transaction_type as 'debit' | 'credit'
      }))

    return {
      userName,
      date: now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      budgetProgress: {
        totalBudget,
        totalSpent,
        totalRemaining,
        percentageUsed,
        isOverBudget: totalRemaining < 0,
        percentageThroughMonth,
        expectedSpending,
        pacingDifference,
        isPacingOver
      },
      categoryBreakdown,
      recentTransactions,
      daysRemainingInMonth
    }
  } catch (error) {
    console.error('Error generating digest data:', error)
    return null
  }
}

// Helper function to calculate rollover (same as in dashboard)
async function calculateRollover(
  supabase: SupabaseClient,
  userId: string,
  targetMonth: number,
  targetYear: number,
  depth = 0
): Promise<Record<string, number>> {
  if (depth > 12) return {}

  const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1
  const prevYear = targetMonth === 1 ? targetYear - 1 : targetYear

  const previousMonthsRollover = await calculateRollover(supabase, userId, prevMonth, prevYear, depth + 1)

  let prevBudgets: any[] | null = null
  let budgetsResult = await supabase
    .from('budgets')
    .select('category_id, amount, enable_rollover')
    .eq('user_id', userId)
    .eq('month', prevMonth)
    .eq('year', prevYear)

  if (budgetsResult.error) {
    budgetsResult = await supabase
      .from('budgets')
      .select('category_id, amount')
      .eq('user_id', userId)
      .eq('month', prevMonth)
      .eq('year', prevYear)
  }

  prevBudgets = budgetsResult.data

  const rolloverEnabledCategories = (prevBudgets || [])
    .filter((b: any) => b.enable_rollover !== false)
    .map((b: any) => b.category_id)

  const rolloverCategories = new Set([
    ...rolloverEnabledCategories,
    ...Object.keys(previousMonthsRollover)
  ])

  if (rolloverCategories.size === 0) {
    return {}
  }

  const prevFirstDay = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
  const prevNextMonth = prevMonth === 12 ? 1 : prevMonth + 1
  const prevNextYear = prevMonth === 12 ? prevYear + 1 : prevYear
  const prevNextMonthFirstDay = `${prevNextYear}-${String(prevNextMonth).padStart(2, '0')}-01`

  const { data: prevTransactions } = await supabase
    .from('transactions')
    .select('category_id, amount, transaction_type, hidden')
    .eq('user_id', userId)
    .gte('date', prevFirstDay)
    .lt('date', prevNextMonthFirstDay)
    .not('deleted', 'eq', true)

  const prevSpending: Record<string, number> = {}
  prevTransactions?.forEach((tx: any) => {
    if (tx.hidden) return
    if (tx.category_id) {
      if (!prevSpending[tx.category_id]) {
        prevSpending[tx.category_id] = 0
      }
      if (tx.transaction_type === 'debit') {
        prevSpending[tx.category_id] += Number(tx.amount)
      } else if (tx.transaction_type === 'credit') {
        prevSpending[tx.category_id] -= Number(tx.amount)
      }
    }
  })

  const rollover: Record<string, number> = {}
  rolloverCategories.forEach(catId => {
    const budget = (prevBudgets || []).find((b: any) => b.category_id === catId)
    const budgetAmount = budget?.amount || 0
    const rolloverEnabled = budget?.enable_rollover !== false

    if (!rolloverEnabled && !previousMonthsRollover[catId]) return

    const spent = prevSpending[catId] || 0
    const prevRollover = previousMonthsRollover[catId] || 0
    const totalAvailable = Number(budgetAmount) + prevRollover
    const remaining = totalAvailable - spent

    if (remaining !== 0) {
      rollover[catId] = remaining
    }
  })

  return rollover
}
