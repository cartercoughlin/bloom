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

    const { id: transactionId } = await params

    if (!transactionId || transactionId === 'undefined' || transactionId === 'null') {
      return NextResponse.json({ error: "Invalid transaction ID" }, { status: 400 })
    }

    const { hidden } = await request.json()

    if (typeof hidden !== 'boolean') {
      return NextResponse.json({ error: "Hidden must be a boolean" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("transactions")
      .update({ hidden })
      .eq("id", transactionId)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!data) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error updating transaction hidden status:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
