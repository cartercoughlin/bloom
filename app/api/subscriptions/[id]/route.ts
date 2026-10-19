import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isMissingSubscriptionsTable, MIGRATION_HINT } from "@/lib/subscriptions"

const STATUSES = ["tracked", "cancelled", "ignored"]
const MAX_NAME_LENGTH = 60

// PATCH /api/subscriptions/:id { status?, name? }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) return NextResponse.json({ error: "Unknown status" }, { status: 400 })
      updates.status = body.status
      // Remember when it was cancelled so later charges stand out
      updates.cancelled_at = body.status === "cancelled" ? new Date().toISOString().slice(0, 10) : null
    }
    if (body.name !== undefined) {
      if (body.name !== null && typeof body.name !== "string") return NextResponse.json({ error: "Invalid name" }, { status: 400 })
      updates.name = body.name?.trim() ? body.name.trim().slice(0, MAX_NAME_LENGTH) : null
    }
    if (Object.keys(updates).length === 1) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })

    const { data, error } = await supabase
      .from("subscriptions")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, merchant_key, name, status, amount, cadence, cancelled_at, created_at")
      .single()
    if (error) {
      if (isMissingSubscriptionsTable(error)) return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
      throw error
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error("Subscription PATCH error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/subscriptions/:id forgets the decision; an active charge goes back to review
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { error } = await supabase.from("subscriptions").delete().eq("id", id).eq("user_id", user.id)
    if (error) {
      if (isMissingSubscriptionsTable(error)) return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
      throw error
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Subscription DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
