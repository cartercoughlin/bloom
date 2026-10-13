// Budget totals and pacing for the dashboard. Pacing uses the same
// expected-spending math as the Budgets page (lib/budget/pacing.ts), so the
// two screens agree on what's spent and what's expected by now.

import type { CategoryTotals } from "@/lib/compute-category-totals"
import type { HistoricalRecurringData } from "@/lib/budget/historical-recurring"
import { expectedSpending, historicalRecurringFor, historyShareFor, PacingHistory, PacingInput } from "@/lib/budget/pacing"

export interface SummaryBudget {
  id: string
  amount: number | string
  category_id: string
  enable_rollover?: boolean | null
  categories?: { name: string; color: string; icon?: string | null } | null
}

export interface MonthProgress {
  isCurrentMonth: boolean
  daysInMonth: number
  // Day of month counted as elapsed (today for the current month)
  day: number
  // Days left including today; 0 for past months
  daysLeft: number
  // 0-1 share of the month elapsed; 1 for past months
  fraction: number
}

export function getMonthProgress(month: number, year: number, now = new Date()): MonthProgress {
  const daysInMonth = new Date(year, month, 0).getDate()
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()
  const isFuture = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1)
  if (isCurrentMonth) {
    const day = now.getDate()
    return { isCurrentMonth, daysInMonth, day, daysLeft: daysInMonth - day + 1, fraction: day / daysInMonth }
  }
  if (isFuture) return { isCurrentMonth, daysInMonth, day: 0, daysLeft: daysInMonth, fraction: 0 }
  return { isCurrentMonth, daysInMonth, day: daysInMonth, daysLeft: 0, fraction: 1 }
}

export interface CategoryStatus {
  categoryId: string
  name: string
  color: string
  icon?: string | null
  budget: number // including rollover
  spent: number
  // Recurring charges historically expected this month that haven't posted yet
  upcomingRecurring: number
  // Expected spending by today, matching this category's pace marker on Budgets
  expected: number
  // spent - expected: positive means behind pace (spending faster than planned)
  pacingDifference: number
  overBy: number // spent beyond budget (0 if within)
}

export interface BudgetSummary {
  totalBudget: number
  totalSpent: number
  remaining: number
  upcomingRecurring: number
  // Remaining after setting aside expected recurring bills
  safeToSpend: number
  // safeToSpend spread over the days left (current month only)
  dailyAllowance: number | null
  // Expected spending by today and spent - expected, matching the Budgets
  // page's Progress bar. null outside the current month.
  expectedTotal: number | null
  pacingDifference: number | null
  // Month-end spending if the rest of the month goes to plan:
  // spent so far plus the plan's expected spending for the remaining days
  projectedTotal: number
  // The plan itself: expected spending by each day of the month
  // (index = day, [0] = 0), including rollover. Current month only.
  expectedByDay: number[] | null
  progress: MonthProgress
  categories: CategoryStatus[]
}

export function summarizeBudgets(
  budgets: SummaryBudget[],
  netByCategory: CategoryTotals,
  rolloverByCategory: Record<string, number>,
  historicalRecurring: HistoricalRecurringData | undefined,
  month: number,
  year: number,
  // Set in history pacing mode
  pacingHistory?: PacingHistory | null,
  now = new Date()
): BudgetSummary {
  const progress = getMonthProgress(month, year, now)
  const pacing = progress.isCurrentMonth
  const { day, daysInMonth } = progress
  const expectedByDay = pacing ? new Array(daysInMonth + 1).fill(0) : null

  let expectedTotal = 0
  let remainingPlanned = 0

  const categories: CategoryStatus[] = budgets.map(b => {
    const totals = netByCategory[b.category_id]
    const income = totals?.income || 0
    const expenses = totals?.expenses || 0
    const recurring = totals?.recurringExpenses || 0
    const rollover = b.enable_rollover !== false ? rolloverByCategory[b.category_id] || 0 : 0
    const budget = Number(b.amount) + rollover

    const spent = Math.max(0, expenses - income)
    const netRecurring = Math.max(0, recurring - income)
    const historical = historicalRecurringFor(historicalRecurring, b.category_id)
    const upcomingRecurring = pacing ? Math.max(0, historical - netRecurring) : 0

    const input: PacingInput = {
      baseBudget: Number(b.amount),
      rollover,
      income,
      recurringExpenses: recurring,
      historicalRecurring: historical,
    }
    const shareOn = (d: number) => historyShareFor(pacingHistory, b.category_id, d, daysInMonth)

    // Rollover counts in full from day 1, both per category and overall
    const expected = pacing ? expectedSpending(input, progress.fraction, true, shareOn(day)) : budget
    if (pacing) {
      expectedTotal += expected
      remainingPlanned += expectedSpending(input, 1, true, shareOn(daysInMonth)) - expected
      // Plan curve: what's expected by each day, before anything has posted
      const planInput = { ...input, income: 0, recurringExpenses: 0 }
      for (let d = 1; d <= daysInMonth; d++) {
        expectedByDay![d] += expectedSpending(planInput, d / daysInMonth, true, shareOn(d))
      }
    }

    return {
      categoryId: b.category_id,
      name: b.categories?.name || "Uncategorized",
      color: b.categories?.color || "#9ca3af",
      icon: b.categories?.icon,
      budget,
      spent,
      upcomingRecurring,
      expected,
      pacingDifference: spent - expected,
      overBy: Math.max(0, spent - budget),
    }
  })

  const totalBudget = categories.reduce((s, c) => s + c.budget, 0)
  const totalSpent = categories.reduce((s, c) => s + c.spent, 0)
  const upcomingRecurring = categories.reduce((s, c) => s + c.upcomingRecurring, 0)
  const remaining = totalBudget - totalSpent
  const safeToSpend = remaining - upcomingRecurring

  return {
    totalBudget,
    totalSpent,
    remaining,
    upcomingRecurring,
    safeToSpend,
    dailyAllowance: pacing && progress.daysLeft > 0 ? safeToSpend / progress.daysLeft : null,
    expectedTotal: pacing ? expectedTotal : null,
    pacingDifference: pacing ? totalSpent - expectedTotal : null,
    projectedTotal: totalSpent + remainingPlanned,
    expectedByDay,
    progress,
    categories,
  }
}

// Categories over budget or behind pace (spending faster than planned), worst first
export function categoriesAtRisk(summary: BudgetSummary): CategoryStatus[] {
  const severity = (c: CategoryStatus) => Math.max(c.overBy, c.pacingDifference) / c.budget
  return summary.categories
    .filter(c => c.budget > 0 && (c.overBy > 0 || (summary.progress.isCurrentMonth && c.pacingDifference > 0.5)))
    .sort((a, b) => severity(b) - severity(a))
}
