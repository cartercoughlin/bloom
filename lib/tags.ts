// Tags track spending for trips, projects or savings goals across categories.
// They're independent of budgets: tagging never changes budget numbers.

export interface Tag {
  id: string
  name: string
  color: string
  target_amount: number | null
  created_at?: string
}

export interface TagWithStats extends Tag {
  transactionCount: number
  spent: number // purchases minus refunds on tagged transactions
  firstDate: string | null
  lastDate: string | null
}

export const TAG_COLORS = [
  "#6366f1", "#0ea5e9", "#14b8a6", "#22c55e", "#eab308",
  "#f97316", "#ef4444", "#ec4899", "#a855f7", "#64748b",
]

export const MIGRATION_HINT = "Tags need a database update: run migrations/add-tags.sql in Supabase"

// The tags tables don't exist until migrations/add-tags.sql has run
export function isMissingTagTables(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return error.code === "42P01" || error.code === "PGRST205" || /transaction_tags|relation .*tags/i.test(error.message || "")
}

// Net spending for a set of transactions, matching how budgets count it:
// hidden and deleted transactions are left out, refunds reduce the total
export function tagSpend(transactions: { amount: number; transaction_type: string; hidden?: boolean | null; deleted?: boolean | null }[]): number {
  return transactions.reduce((sum, tx) => {
    if (tx.hidden || tx.deleted) return sum
    return sum + (tx.transaction_type === "credit" ? -Number(tx.amount) : Number(tx.amount))
  }, 0)
}
