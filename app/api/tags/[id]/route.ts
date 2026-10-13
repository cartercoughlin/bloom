import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isMissingTagTables, MIGRATION_HINT } from "@/lib/tags"

const MAX_NAME_LENGTH = 40

// PATCH /api/tags/:id { name?, color?, target_amount? }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const updates: Record<string, unknown> = {}

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : ""
      if (!name || name.length > MAX_NAME_LENGTH) {
        return NextResponse.json({ error: `Tag names must be 1-${MAX_NAME_LENGTH} characters` }, { status: 400 })
      }
      updates.name = name
    }
    if (body.color !== undefined) {
      if (typeof body.color !== "string" || !/^#[0-9a-f]{6}$/i.test(body.color)) {
        return NextResponse.json({ error: "Color must be a hex value like #22c55e" }, { status: 400 })
      }
      updates.color = body.color
    }
    if (body.target_amount !== undefined) {
      const target = body.target_amount === null || body.target_amount === "" ? null : Number(body.target_amount)
      if (target !== null && (!Number.isFinite(target) || target < 0)) {
        return NextResponse.json({ error: "Target must be a positive amount" }, { status: 400 })
      }
      updates.target_amount = target
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("tags")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, name, color, target_amount, created_at")
      .single()
    if (error) {
      if (isMissingTagTables(error)) return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
      if (error.code === "23505") return NextResponse.json({ error: "You already have a tag with that name" }, { status: 409 })
      throw error
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error("Tag PATCH error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/tags/:id removes the tag from every transaction; transactions stay
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { error } = await supabase.from("tags").delete().eq("id", id).eq("user_id", user.id)
    if (error) {
      if (isMissingTagTables(error)) return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
      throw error
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Tag DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
