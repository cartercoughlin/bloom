import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isMissingTagTables, MIGRATION_HINT } from "@/lib/tags"

const MAX_BATCH = 500

const isIdList = (v: unknown, max: number): v is string[] =>
  Array.isArray(v) && v.length <= max && v.every(id => typeof id === "string" && id.length > 0)

// POST /api/transactions/tags { transactionIds: string[], add?: string[], remove?: string[] }
// Adds and/or removes tags on many transactions at once.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { transactionIds, add = [], remove = [] } = await request.json()
    if (!isIdList(transactionIds, MAX_BATCH) || transactionIds.length === 0) {
      return NextResponse.json({ error: `transactionIds must be 1-${MAX_BATCH} ids` }, { status: 400 })
    }
    if (!isIdList(add, 50) || !isIdList(remove, 50) || add.length + remove.length === 0) {
      return NextResponse.json({ error: "Provide tags to add or remove" }, { status: 400 })
    }

    // Only the user's own tags and transactions
    const { data: ownTags, error: tagsError } = await supabase
      .from("tags")
      .select("id")
      .eq("user_id", user.id)
      .in("id", [...add, ...remove])
    if (tagsError) {
      if (isMissingTagTables(tagsError)) return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
      throw tagsError
    }
    const ownTagIds = new Set((ownTags || []).map(t => t.id))
    if ([...add, ...remove].some(id => !ownTagIds.has(id))) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 })
    }

    const { data: ownTxs, error: txError } = await supabase
      .from("transactions")
      .select("id")
      .eq("user_id", user.id)
      .in("id", transactionIds)
    if (txError) throw txError
    const ids = (ownTxs || []).map(t => t.id)
    if (ids.length === 0) return NextResponse.json({ error: "Transactions not found" }, { status: 404 })

    if (add.length > 0) {
      const rows = ids.flatMap(transaction_id => add.map((tag_id: string) => ({ transaction_id, tag_id, user_id: user.id })))
      const { error } = await supabase
        .from("transaction_tags")
        .upsert(rows, { onConflict: "transaction_id,tag_id", ignoreDuplicates: true })
      if (error) throw error
    }
    if (remove.length > 0) {
      const { error } = await supabase
        .from("transaction_tags")
        .delete()
        .eq("user_id", user.id)
        .in("transaction_id", ids)
        .in("tag_id", remove)
      if (error) throw error
    }

    return NextResponse.json({ updated: ids.length })
  } catch (error) {
    console.error("Transaction tags error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
