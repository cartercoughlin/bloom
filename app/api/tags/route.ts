import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchAllRows } from "@/lib/supabase/fetch-all"
import { isMissingTagTables, MIGRATION_HINT, tagSpend, TAG_COLORS, type TagWithStats } from "@/lib/tags"

const MAX_NAME_LENGTH = 40

// GET /api/tags: every tag with its transaction count, net spending and date range
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: tags, error } = await supabase
      .from("tags")
      .select("id, name, color, target_amount, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    if (error) {
      if (isMissingTagTables(error)) return NextResponse.json({ tags: [], needsMigration: true })
      throw error
    }

    const links = await fetchAllRows<any>((from, to) =>
      supabase
        .from("transaction_tags")
        .select("tag_id, transactions (amount, transaction_type, date, hidden, deleted)")
        .eq("user_id", user.id)
        .order("transaction_id")
        .order("tag_id")
        .range(from, to)
    )

    const byTag = new Map<string, any[]>()
    for (const link of links) {
      if (!link.transactions) continue
      ;(byTag.get(link.tag_id) || byTag.set(link.tag_id, []).get(link.tag_id)!).push(link.transactions)
    }

    const result: TagWithStats[] = (tags || []).map(tag => {
      const txs = (byTag.get(tag.id) || []).filter(tx => !tx.deleted)
      const dates = txs.map(tx => String(tx.date)).sort()
      return {
        ...tag,
        target_amount: tag.target_amount === null ? null : Number(tag.target_amount),
        transactionCount: txs.length,
        spent: Math.round(tagSpend(txs) * 100) / 100,
        firstDate: dates[0] || null,
        lastDate: dates[dates.length - 1] || null,
      }
    })

    return NextResponse.json({ tags: result, needsMigration: false })
  } catch (error) {
    console.error("Tags GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/tags { name, color?, target_amount? }
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (!name || name.length > MAX_NAME_LENGTH) {
      return NextResponse.json({ error: `Tag names must be 1-${MAX_NAME_LENGTH} characters` }, { status: 400 })
    }

    let color = typeof body.color === "string" && /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : null
    if (!color) {
      // Rotate through the palette so new tags look distinct
      const { count } = await supabase.from("tags").select("id", { count: "exact", head: true }).eq("user_id", user.id)
      color = TAG_COLORS[(count || 0) % TAG_COLORS.length]
    }
    const target = body.target_amount === null || body.target_amount === undefined || body.target_amount === ""
      ? null
      : Number(body.target_amount)
    if (target !== null && (!Number.isFinite(target) || target < 0)) {
      return NextResponse.json({ error: "Target must be a positive amount" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("tags")
      .insert({ user_id: user.id, name, color, target_amount: target })
      .select("id, name, color, target_amount, created_at")
      .single()
    if (error) {
      if (isMissingTagTables(error)) return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
      if (error.code === "23505") return NextResponse.json({ error: `You already have a tag named "${name}"` }, { status: 409 })
      throw error
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Tags POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
