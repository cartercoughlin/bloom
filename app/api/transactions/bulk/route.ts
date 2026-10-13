import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

const MAX_BATCH = 500

// Update category and/or hidden status for many transactions at once.
// Body: { transactionIds: string[], categoryId?: string | null, hidden?: boolean }
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { transactionIds, categoryId, hidden } = await request.json()

    if (
      !Array.isArray(transactionIds) ||
      transactionIds.length === 0 ||
      transactionIds.length > MAX_BATCH ||
      !transactionIds.every((id) => typeof id === "string" && id.length > 0)
    ) {
      return NextResponse.json({ error: `transactionIds must be 1-${MAX_BATCH} ids` }, { status: 400 })
    }

    const updates: { category_id?: string | null; hidden?: boolean } = {}

    if (categoryId !== undefined) {
      if (categoryId !== null && typeof categoryId !== "string") {
        return NextResponse.json({ error: "categoryId must be a string or null" }, { status: 400 })
      }
      if (categoryId) {
        const { data: category } = await supabase
          .from("categories")
          .select("id")
          .eq("id", categoryId)
          .eq("user_id", user.id)
          .maybeSingle()
        if (!category) {
          return NextResponse.json({ error: "Category not found" }, { status: 404 })
        }
      }
      updates.category_id = categoryId || null
    }

    if (hidden !== undefined) {
      if (typeof hidden !== "boolean") {
        return NextResponse.json({ error: "hidden must be a boolean" }, { status: 400 })
      }
      updates.hidden = hidden
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("transactions")
      .update(updates)
      .in("id", transactionIds)
      .eq("user_id", user.id)
      .select("id")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ updated: data?.map((row) => row.id) || [] })
  } catch (error) {
    console.error("Error bulk updating transactions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
