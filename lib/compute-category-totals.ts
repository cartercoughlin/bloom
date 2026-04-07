// Shared helper to compute net spending by category from a list of transactions.
// Used by both dashboard and budgets pages, and when restoring from cache.

export interface CategoryTotals {
  [categoryId: string]: {
    income: number
    expenses: number
    net: number
    recurringExpenses: number
    variableExpenses: number
  }
}

export function computeCategoryTotals(transactions: any[]): CategoryTotals {
  const totals: CategoryTotals = {}

  for (const tx of transactions) {
    if (!tx.category_id || tx.hidden) continue

    if (!totals[tx.category_id]) {
      totals[tx.category_id] = {
        income: 0,
        expenses: 0,
        net: 0,
        recurringExpenses: 0,
        variableExpenses: 0,
      }
    }

    const cat = totals[tx.category_id]
    if (tx.transaction_type === "credit") {
      cat.income += Number(tx.amount)
    } else {
      cat.expenses += Number(tx.amount)
      if (tx.recurring) {
        cat.recurringExpenses += Number(tx.amount)
      } else {
        cat.variableExpenses += Number(tx.amount)
      }
    }
    cat.net = cat.income - cat.expenses
  }

  return totals
}
