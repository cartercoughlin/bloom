import Anthropic from "@anthropic-ai/sdk"
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

type Json = Record<string, unknown>

function jsonResult(data: unknown): string {
  return JSON.stringify(data, null, 2)
}

function makeTools(supabase: SupabaseClient) {
  const getCurrentMonthSummary = betaZodTool({
    name: "get_current_month_summary",
    description:
      "Returns the user's spending vs budget for the current calendar month, " +
      "broken down per category. Use this for general 'how am I doing' questions.",
    inputSchema: z.object({}),
    run: async () => {
      const now = new Date()
      const month = now.getMonth() + 1
      const year = now.getFullYear()
      const monthStart = `${year}-${String(month).padStart(2, "0")}-01`
      const nextMonth = month === 12 ? 1 : month + 1
      const nextYear = month === 12 ? year + 1 : year
      const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`

      const [{ data: budgets }, { data: txs }, { data: categories }] = await Promise.all([
        supabase.from("budgets").select("category_id, amount").eq("month", month).eq("year", year),
        supabase
          .from("transactions")
          .select("category_id, amount, transaction_type, hidden")
          .gte("date", monthStart)
          .lt("date", monthEnd),
        supabase.from("categories").select("id, name"),
      ])

      const categoryName = new Map((categories ?? []).map((c) => [c.id, c.name as string]))
      const spentByCategory = new Map<string, number>()
      let totalSpent = 0
      let totalIncome = 0
      for (const t of txs ?? []) {
        if (t.hidden) continue
        const amount = Number(t.amount)
        if (t.transaction_type === "debit") {
          totalSpent += amount
          if (t.category_id) spentByCategory.set(t.category_id, (spentByCategory.get(t.category_id) ?? 0) + amount)
        } else {
          totalIncome += amount
        }
      }

      const totalBudget = (budgets ?? []).reduce((s, b) => s + Number(b.amount), 0)
      const perCategory = (budgets ?? []).map((b) => {
        const spent = spentByCategory.get(b.category_id) ?? 0
        return {
          category: categoryName.get(b.category_id) ?? "Uncategorized",
          budget: Number(b.amount),
          spent: Number(spent.toFixed(2)),
          remaining: Number((Number(b.amount) - spent).toFixed(2)),
        }
      })

      const dayOfMonth = now.getDate()
      const daysInMonth = new Date(year, month, 0).getDate()
      const percentThroughMonth = Math.round((dayOfMonth / daysInMonth) * 100)

      return jsonResult({
        month_label: now.toLocaleString("en-US", { month: "long", year: "numeric" }),
        day_of_month: dayOfMonth,
        days_in_month: daysInMonth,
        percent_through_month: percentThroughMonth,
        total_budget: Number(totalBudget.toFixed(2)),
        total_spent: Number(totalSpent.toFixed(2)),
        total_income: Number(totalIncome.toFixed(2)),
        remaining_budget: Number((totalBudget - totalSpent).toFixed(2)),
        per_category: perCategory,
      })
    },
  })

  const getSpendingByCategory = betaZodTool({
    name: "get_spending_by_category",
    description:
      "Total spending in a specific category for a given month/year. " +
      "Pass category_name to filter; pass month and year (1-12, full year) to scope. " +
      "Defaults to the current month.",
    inputSchema: z.object({
      category_name: z.string().describe("Case-insensitive category name match"),
      month: z.number().int().min(1).max(12).optional(),
      year: z.number().int().min(2000).max(2100).optional(),
    }),
    run: async ({ category_name, month, year }) => {
      const now = new Date()
      const m = month ?? now.getMonth() + 1
      const y = year ?? now.getFullYear()
      const start = `${y}-${String(m).padStart(2, "0")}-01`
      const nm = m === 12 ? 1 : m + 1
      const ny = m === 12 ? y + 1 : y
      const end = `${ny}-${String(nm).padStart(2, "0")}-01`

      const { data: cats } = await supabase
        .from("categories")
        .select("id, name")
        .ilike("name", category_name)
      const ids = (cats ?? []).map((c) => c.id)
      if (ids.length === 0) {
        return jsonResult({ error: `No category matching "${category_name}" found.` })
      }

      const { data: txs } = await supabase
        .from("transactions")
        .select("amount, transaction_type, hidden")
        .in("category_id", ids)
        .gte("date", start)
        .lt("date", end)

      let spent = 0
      let count = 0
      for (const t of txs ?? []) {
        if (t.hidden) continue
        if (t.transaction_type !== "debit") continue
        spent += Number(t.amount)
        count++
      }

      const { data: budgets } = await supabase
        .from("budgets")
        .select("amount")
        .in("category_id", ids)
        .eq("month", m)
        .eq("year", y)
      const budget = (budgets ?? []).reduce((s, b) => s + Number(b.amount), 0)

      return jsonResult({
        category: cats![0].name,
        month: m,
        year: y,
        spent: Number(spent.toFixed(2)),
        transaction_count: count,
        budget: Number(budget.toFixed(2)),
        remaining: Number((budget - spent).toFixed(2)),
      })
    },
  })

  const listRecentTransactions = betaZodTool({
    name: "list_recent_transactions",
    description:
      "List the user's most recent transactions, optionally filtered by category. " +
      "Use this when the user asks 'what did I spend on X recently' or wants to review activity.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).default(10),
      category_name: z.string().optional().describe("Optional case-insensitive category filter"),
      since_days: z
        .number()
        .int()
        .min(1)
        .max(365)
        .optional()
        .describe("Only include transactions from the last N days"),
    }),
    run: async ({ limit, category_name, since_days }) => {
      let categoryIds: string[] | null = null
      if (category_name) {
        const { data: cats } = await supabase
          .from("categories")
          .select("id, name")
          .ilike("name", category_name)
        categoryIds = (cats ?? []).map((c) => c.id)
        if (categoryIds.length === 0) {
          return jsonResult({ error: `No category matching "${category_name}" found.` })
        }
      }

      let q = supabase
        .from("transactions")
        .select("date, description, merchant_name, amount, transaction_type, category_id")
        .eq("hidden", false)
        .order("date", { ascending: false })
        .limit(limit)
      if (categoryIds) q = q.in("category_id", categoryIds)
      if (since_days) {
        const since = new Date()
        since.setDate(since.getDate() - since_days)
        q = q.gte("date", since.toISOString().slice(0, 10))
      }

      const { data: txs } = await q
      const { data: cats } = await supabase.from("categories").select("id, name")
      const catName = new Map((cats ?? []).map((c) => [c.id, c.name as string]))

      const rows = (txs ?? []).map((t) => ({
        date: t.date,
        description: t.merchant_name || t.description,
        amount: Number(t.amount),
        type: t.transaction_type,
        category: t.category_id ? catName.get(t.category_id) ?? null : null,
      }))
      return jsonResult({ count: rows.length, transactions: rows })
    },
  })

  const searchTransactions = betaZodTool({
    name: "search_transactions",
    description:
      "Search the user's transactions by description or merchant name. " +
      "Use when the user asks about a specific store, payee, or keyword (e.g. 'how much did I spend at Whole Foods').",
    inputSchema: z.object({
      query: z.string().min(1).describe("Substring to match against description and merchant_name"),
      limit: z.number().int().min(1).max(100).default(25),
    }),
    run: async ({ query, limit }) => {
      const pattern = `%${query}%`
      const { data: txs } = await supabase
        .from("transactions")
        .select("date, description, merchant_name, amount, transaction_type")
        .eq("hidden", false)
        .or(`description.ilike.${pattern},merchant_name.ilike.${pattern}`)
        .order("date", { ascending: false })
        .limit(limit)

      let totalDebit = 0
      let totalCredit = 0
      for (const t of txs ?? []) {
        const a = Number(t.amount)
        if (t.transaction_type === "debit") totalDebit += a
        else totalCredit += a
      }

      return jsonResult({
        query,
        count: txs?.length ?? 0,
        total_spent: Number(totalDebit.toFixed(2)),
        total_received: Number(totalCredit.toFixed(2)),
        transactions: (txs ?? []).map((t) => ({
          date: t.date,
          description: t.merchant_name || t.description,
          amount: Number(t.amount),
          type: t.transaction_type,
        })),
      })
    },
  })

  const getAccountBalances = betaZodTool({
    name: "get_account_balances",
    description:
      "Returns current account balances and overall net worth. " +
      "Use when the user asks about cash position, savings, debts, or net worth.",
    inputSchema: z.object({}),
    run: async () => {
      const { data: accounts } = await supabase
        .from("account_balances")
        .select("account_name, account_type, balance")
        .order("account_type")

      let assets = 0
      let liabilities = 0
      for (const a of accounts ?? []) {
        const b = Number(a.balance)
        if (a.account_type === "liability") liabilities += b
        else assets += b
      }

      return jsonResult({
        accounts: (accounts ?? []).map((a) => ({
          name: a.account_name,
          type: a.account_type,
          balance: Number(a.balance),
        })),
        total_assets: Number(assets.toFixed(2)),
        total_liabilities: Number(liabilities.toFixed(2)),
        net_worth: Number((assets - liabilities).toFixed(2)),
      })
    },
  })

  return [
    getCurrentMonthSummary,
    getSpendingByCategory,
    listRecentTransactions,
    searchTransactions,
    getAccountBalances,
  ]
}

const SYSTEM_PROMPT = `You are Bloom, a friendly personal-finance assistant embedded inside the user's budget app.

You have read-only access to the user's data through tools. Use them aggressively — never guess at numbers. If a question can be answered with a tool, call the tool first and then answer from the result.

Style:
- Be concise. Most answers are 1–3 short sentences.
- Lead with the number, then a brief observation if helpful.
- Format currency as $X,XXX.XX. Use plain numbers, no LaTeX.
- If the user is on track, say so. If they're trending over budget, flag it gently with the gap.
- Don't moralize about spending.

When the user asks about "this month" or omits a timeframe, default to the current calendar month.`

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured on the server." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }

  let body: { messages?: Anthropic.Beta.BetaMessageParam[] }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 })
  }
  const messages = body.messages ?? []
  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages is required" }), { status: 400 })
  }

  const client = new Anthropic()
  const tools = makeTools(supabase)

  const today = new Date().toISOString().slice(0, 10)
  const system = `${SYSTEM_PROMPT}\n\nToday's date is ${today}.`

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Json) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }
      try {
        const runner = client.beta.messages.toolRunner({
          model: "claude-opus-4-7",
          max_tokens: 4096,
          system,
          tools,
          messages,
          stream: true,
        })

        for await (const messageStream of runner) {
          for await (const event of messageStream) {
            if (event.type === "content_block_start") {
              if (event.content_block.type === "tool_use") {
                send({ type: "tool_use", name: event.content_block.name })
              }
            } else if (event.type === "content_block_delta") {
              if (event.delta.type === "text_delta") {
                send({ type: "text", text: event.delta.text })
              }
            }
          }
        }
        send({ type: "done" })
      } catch (err) {
        const message =
          err instanceof Anthropic.APIError
            ? `${err.status ?? ""} ${err.message}`.trim()
            : err instanceof Error
              ? err.message
              : "Unknown error"
        send({ type: "error", message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
