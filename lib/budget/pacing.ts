// Expected spending so far this month: the "pace" marker on the Budgets page.
// Shared by the overview Progress bar, per-category budget bars and the
// dashboard so they all agree.

import type { HistoricalRecurringData } from "@/lib/budget/historical-recurring"

export interface PacingInput {
  baseBudget: number // budget amount before rollover
  rollover: number
  income: number
  recurringExpenses: number
  // Typical monthly recurring spend for this category (historical average)
  historicalRecurring: number
}

/**
 * Expected spending after `fraction` (0-1) of the month.
 *
 * With recurring history: expect at least the historical recurring baseline
 * pro-rated (or what's already posted, if more), plus the rest of the base
 * budget spread evenly through the month.
 * Without it: recurring already posted, plus the rest of the base budget
 * spread evenly.
 *
 * `includeRollover` adds rollover in full, since it's available from day 1.
 * The per-category bars include it; the overview Progress bar does not.
 */
export function expectedSpending(c: PacingInput, fraction: number, includeRollover: boolean): number {
  const netRecurring = Math.max(0, c.recurringExpenses - c.income)
  let expected: number
  if (c.historicalRecurring > 0) {
    const expectedRecurring = Math.max(netRecurring, c.historicalRecurring * fraction)
    const expectedVariable = Math.max(0, c.baseBudget - c.historicalRecurring) * fraction
    expected = expectedRecurring + expectedVariable
  } else {
    expected = netRecurring + Math.max(0, c.baseBudget - netRecurring) * fraction
  }
  return expected + (includeRollover ? c.rollover : 0)
}

// Historical recurring average for a category, or 0 when there's no usable history
export function historicalRecurringFor(historical: HistoricalRecurringData | undefined, categoryId: string): number {
  if (!historical || historical.monthsUsed <= 0) return 0
  return historical.byCategory?.[categoryId] || 0
}

// Share of the month elapsed (0-1) for pacing, or null when not the current month
export function monthFractionForPacing(month: number, year: number, now = new Date()): number | null {
  if (month !== now.getMonth() + 1 || year !== now.getFullYear()) return null
  return now.getDate() / new Date(year, month, 0).getDate()
}
