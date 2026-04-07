import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = parseInt(searchParams.get("month") || "", 10)
    const year = parseInt(searchParams.get("year") || "", 10)

    if (!month || !year || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Valid month (1-12) and year are required" },
        { status: 400 }
      )
    }

    // Compute the 12-month lookback window.
    // We need months [target-12 .. target-1] (the target month itself is not
    // included because rollover represents what carries INTO the target month).
    const months: { month: number; year: number }[] = []
    let m = month
    let y = year
    for (let i = 0; i < 12; i++) {
      // Step back one month
      m = m === 1 ? 12 : m - 1
      y = m === 12 ? y - 1 : y
      months.unshift({ month: m, year: y }) // prepend so oldest is first
    }

    // Build date range for transactions: from the first day of the oldest
    // month to the first day of the target month.
    const oldest = months[0]
    const dateStart = `${oldest.year}-${String(oldest.month).padStart(2, "0")}-01`
    const dateEnd = `${year}-${String(month).padStart(2, "0")}-01`

    // Determine the range of years we need so we can filter efficiently.
    const yearsInRange = [...new Set(months.map((m) => m.year))]

    // Fetch all budgets and all transactions in parallel — just 2 queries.
    const [budgetsResult, transactionsResult] = await Promise.all([
      supabase
        .from("budgets")
        .select("category_id, amount, enable_rollover, month, year")
        .eq("user_id", user.id)
        .in("year", yearsInRange),
      supabase
        .from("transactions")
        .select("category_id, amount, transaction_type, hidden, date")
        .eq("user_id", user.id)
        .gte("date", dateStart)
        .lt("date", dateEnd)
        .not("deleted", "eq", true),
    ])

    if (budgetsResult.error) {
      // The enable_rollover column might not exist yet — retry without it.
      const fallback = await supabase
        .from("budgets")
        .select("category_id, amount, month, year")
        .eq("user_id", user.id)
        .in("year", yearsInRange)

      if (fallback.error) {
        return NextResponse.json(
          { error: "Failed to fetch budgets" },
          { status: 500 }
        )
      }

      budgetsResult.data = fallback.data
    }

    if (transactionsResult.error) {
      return NextResponse.json(
        { error: "Failed to fetch transactions" },
        { status: 500 }
      )
    }

    const allBudgets = budgetsResult.data || []
    const allTransactions = transactionsResult.data || []

    // Index budgets by "year-month"
    const budgetsByMonth: Record<string, typeof allBudgets> = {}
    for (const b of allBudgets) {
      const key = `${b.year}-${b.month}`
      if (!budgetsByMonth[key]) budgetsByMonth[key] = []
      budgetsByMonth[key].push(b)
    }

    // Compute net spending per category per month from transactions.
    // Net spending = sum of debits - sum of credits (for each category).
    const spendingByMonth: Record<string, Record<string, number>> = {}
    for (const tx of allTransactions) {
      if (tx.hidden || !tx.category_id) continue
      const d = new Date(tx.date)
      const txMonth = d.getUTCMonth() + 1
      const txYear = d.getUTCFullYear()
      const key = `${txYear}-${txMonth}`

      if (!spendingByMonth[key]) spendingByMonth[key] = {}
      if (!spendingByMonth[key][tx.category_id]) spendingByMonth[key][tx.category_id] = 0

      if (tx.transaction_type === "debit") {
        spendingByMonth[key][tx.category_id] += Number(tx.amount)
      } else if (tx.transaction_type === "credit") {
        spendingByMonth[key][tx.category_id] -= Number(tx.amount)
      }
    }

    // Forward pass: accumulate rollover from oldest month to most recent.
    let rollover: Record<string, number> = {}

    for (const { month: m, year: y } of months) {
      const key = `${y}-${m}`
      const monthBudgets = budgetsByMonth[key] || []
      const monthSpending = spendingByMonth[key] || {}

      // Categories eligible for rollover this month: those with a budget that
      // has rollover enabled, plus any category already carrying rollover.
      const rolloverEnabledCategories = monthBudgets
        .filter((b: any) => b.enable_rollover !== false)
        .map((b: any) => b.category_id)

      const rolloverCategories = new Set([
        ...rolloverEnabledCategories,
        ...Object.keys(rollover),
      ])

      const nextRollover: Record<string, number> = {}

      for (const catId of rolloverCategories) {
        const budget = monthBudgets.find((b: any) => b.category_id === catId)
        const rolloverEnabled = budget ? budget.enable_rollover !== false : true

        // If this category now has an explicit budget with rollover disabled,
        // drop it from the accumulator.
        if (!rolloverEnabled) continue

        const budgetAmount = budget?.amount ? Number(budget.amount) : 0
        const spent = monthSpending[catId] || 0
        const prevRollover = rollover[catId] || 0
        const remaining = Number(budgetAmount) + prevRollover - spent

        if (remaining !== 0) {
          nextRollover[catId] = remaining
        }
      }

      rollover = nextRollover
    }

    return NextResponse.json(rollover)
  } catch (error) {
    console.error("Rollover API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
