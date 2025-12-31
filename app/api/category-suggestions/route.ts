import { createClient } from "@/lib/supabase/server"
import { suggestCategories } from "@/lib/category-rules"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { transactionId, description, amount } = await request.json()

    const suggestions = await suggestCategories(
      transactionId || null,
      description,
      amount,
      user.id
    )

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error("Error getting suggestions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
