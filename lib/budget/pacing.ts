// Expected spending so far this month: the "pace" marker on the Budgets page.
// Shared by the overview Progress bar, per-category budget bars and the
// dashboard so they all agree.

import type { HistoricalRecurringData } from "@/lib/budget/historical-recurring"

// "even": the rest of the budget is spread evenly through the month.
// "history": follows when this category's spending usually happens, from
// every past month on record (see /api/pacing-history).
export type PacingMode = "even" | "history"

// Per category: average cumulative share of a month's spending by each day
// of the month (shares[d], d = 1..31), and how many months it's based on
export type PacingHistory = Record<string, { months: number; shares: number[] }>

// A timing curve needs a few months before it's more useful than even pacing
export const MIN_HISTORY_MONTHS = 2

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
 * With `historyShare` (history mode): the base budget times the share of
 * spending that has usually happened by this day of the month.
 *
 * `includeRollover` adds rollover in full, since it's available from day 1.
 * Every pace on Budgets and the dashboard includes it.
 */
export function expectedSpending(
  c: PacingInput,
  fraction: number,
  includeRollover: boolean,
  // Share of the month's spending that usually happens by now (history mode)
  historyShare?: number | null
): number {
  const netRecurring = Math.max(0, c.recurringExpenses - c.income)
  let expected: number
  if (historyShare !== undefined && historyShare !== null) {
    // History mode: the usual timing already includes recurring bills; only
    // count more if this month's bills have posted earlier than usual
    expected = Math.max(netRecurring, c.baseBudget * historyShare)
  } else if (c.historicalRecurring > 0) {
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

// Share of this category's spending that usually happens by `day`, or null
// to fall back to even pacing (not enough history, or no history mode)
export function historyShareFor(
  history: PacingHistory | null | undefined,
  categoryId: string,
  day: number,
  daysInMonth: number
): number | null {
  const entry = history?.[categoryId]
  if (!entry || entry.months < MIN_HISTORY_MONTHS) return null
  if (day >= daysInMonth) return 1
  return entry.shares[Math.min(31, Math.max(0, day))] ?? null
}
