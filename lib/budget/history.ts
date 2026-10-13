// Month-by-month spending vs. budget for the dashboard history chart.

import { computeCategoryTotals } from "@/lib/compute-category-totals"

export interface HistoryTransaction {
  category_id: string | null
  amount: number
  transaction_type: string
  recurring?: boolean | null
  hidden?: boolean | null
  date: string
}

export interface HistoryBudget {
  category_id: string
  amount: number | string
  month: number
  year: number
}

export interface MonthHistory {
  key: string // YYYY-MM
  label: string // "Oct"
  month: number
  year: number
  spent: number
  budget: number | null // base budget (no rollover); null if none set that month
  isPartial: boolean // month still in progress
}

// The `count` months ending with month/year, oldest first
export function monthRange(month: number, year: number, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(year, month - 1 - (count - 1 - i), 1)
    return { month: d.getMonth() + 1, year: d.getFullYear() }
  })
}

export function buildMonthlyHistory(
  transactions: HistoryTransaction[],
  budgets: HistoryBudget[],
  month: number,
  year: number,
  count = 6,
  now = new Date()
): MonthHistory[] {
  const byMonth = new Map<string, HistoryTransaction[]>()
  for (const tx of transactions) {
    const key = tx.date.slice(0, 7)
    ;(byMonth.get(key) || byMonth.set(key, []).get(key)!).push(tx)
  }

  return monthRange(month, year, count).map(({ month: m, year: y }) => {
    const key = `${y}-${String(m).padStart(2, "0")}`
    const monthBudgets = budgets.filter(b => b.month === m && b.year === y)
    const totals = computeCategoryTotals(byMonth.get(key) || [])

    // Same definition as the Budgets page: net spending in budgeted categories.
    // Months without budgets fall back to all categorized spending.
    const categoryIds = monthBudgets.length > 0 ? monthBudgets.map(b => b.category_id) : Object.keys(totals)
    const spent = categoryIds.reduce((sum, id) => {
      const t = totals[id]
      return t ? sum + Math.max(0, t.expenses - t.income) : sum
    }, 0)

    return {
      key,
      label: new Date(y, m - 1).toLocaleString("en-US", { month: "short" }),
      month: m,
      year: y,
      spent: Math.round(spent * 100) / 100,
      budget: monthBudgets.length > 0 ? monthBudgets.reduce((s, b) => s + Number(b.amount), 0) : null,
      isPartial: m === now.getMonth() + 1 && y === now.getFullYear(),
    }
  })
}
