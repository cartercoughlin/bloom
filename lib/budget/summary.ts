// Budget totals, pacing and month-end projections shared by the dashboard.
// Mirrors the per-category math on the Budgets page (components/budget-list.tsx)
// so both screens agree on what's spent and what's expected.

import type { CategoryTotals } from "@/lib/compute-category-totals"
import type { HistoricalRecurringData } from "@/lib/budget/historical-recurring"

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
  // Where spending lands at month end at the current pace
  projected: number
  overBy: number // spent beyond budget (0 if within)
  projectedOverBy: number // projected beyond budget (0 if within)
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
  projectedTotal: number
  progress: MonthProgress
  categories: CategoryStatus[]
}

// Too early in the month for a linear projection to mean much
const MIN_FRACTION_FOR_PROJECTION = 0.15

export function summarizeBudgets(
  budgets: SummaryBudget[],
  netByCategory: CategoryTotals,
  rolloverByCategory: Record<string, number>,
  historicalRecurring: HistoricalRecurringData | undefined,
  month: number,
  year: number,
  now = new Date()
): BudgetSummary {
  const progress = getMonthProgress(month, year, now)

  const categories: CategoryStatus[] = budgets.map(b => {
    const totals = netByCategory[b.category_id]
    const income = totals?.income || 0
    const expenses = totals?.expenses || 0
    const recurring = totals?.recurringExpenses || 0
    const rollover = b.enable_rollover !== false ? rolloverByCategory[b.category_id] || 0 : 0
    const budget = Number(b.amount) + rollover

    const spent = Math.max(0, expenses - income)
    const netRecurring = Math.max(0, recurring - income)
    const variableSpent = Math.max(0, spent - netRecurring)

    const historical = historicalRecurring?.byCategory?.[b.category_id] || 0
    const upcomingRecurring = progress.isCurrentMonth ? Math.max(0, historical - netRecurring) : 0

    let projected = spent
    if (progress.isCurrentMonth && progress.fraction >= MIN_FRACTION_FOR_PROJECTION) {
      projected = netRecurring + upcomingRecurring + variableSpent / progress.fraction
    } else if (progress.isCurrentMonth) {
      projected = spent + upcomingRecurring
    }

    return {
      categoryId: b.category_id,
      name: b.categories?.name || "Uncategorized",
      color: b.categories?.color || "#9ca3af",
      icon: b.categories?.icon,
      budget,
      spent,
      upcomingRecurring,
      projected,
      overBy: Math.max(0, spent - budget),
      projectedOverBy: Math.max(0, projected - budget),
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
    dailyAllowance: progress.isCurrentMonth && progress.daysLeft > 0 ? safeToSpend / progress.daysLeft : null,
    projectedTotal: categories.reduce((s, c) => s + c.projected, 0),
    progress,
    categories,
  }
}

// Categories over budget or on pace to be, worst first
export function categoriesAtRisk(summary: BudgetSummary): CategoryStatus[] {
  return summary.categories
    .filter(c => c.budget > 0 && (c.overBy > 0 || c.projectedOverBy > 0))
    .sort((a, b) => Math.max(b.overBy, b.projectedOverBy) / b.budget - Math.max(a.overBy, a.projectedOverBy) / a.budget)
}
