import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: ruleId } = await params

    if (!ruleId || ruleId === 'undefined' || ruleId === 'null') {
      return NextResponse.json({ error: "Invalid rule ID" }, { status: 400 })
    }

    const body = await request.json()
    const {
      name,
      category_id,
      priority,
      is_active,
      description_pattern,
      amount_min,
      amount_max,
      transaction_type,
      bank_pattern,
      account_pattern,
      institution_pattern,
    } = body

    const { data, error } = await supabase
      .from("category_rules")
      .update({
        name,
        category_id,
        priority,
        is_active,
        description_pattern: description_pattern || null,
        amount_min: amount_min || null,
        amount_max: amount_max || null,
        transaction_type: transaction_type || null,
        bank_pattern: bank_pattern || null,
        account_pattern: account_pattern || null,
        institution_pattern: institution_pattern || null,
      })
      .eq("id", ruleId)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!data) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error updating rule:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: ruleId } = await params

    if (!ruleId || ruleId === 'undefined' || ruleId === 'null') {
      return NextResponse.json({ error: "Invalid rule ID" }, { status: 400 })
    }

    const { error } = await supabase
      .from("category_rules")
      .delete()
      .eq("id", ruleId)
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting rule:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
