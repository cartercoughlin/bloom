import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!id || id === 'undefined' || id === 'null') {
      return NextResponse.json({ error: "Invalid transaction ID" }, { status: 400 })
    }

    const { recurring } = await request.json()

    if (typeof recurring !== "boolean") {
      return NextResponse.json({ error: "Recurring must be a boolean" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("transactions")
      .update({ recurring })
      .eq("id", id)
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
    console.error("Error updating transaction recurring status:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
