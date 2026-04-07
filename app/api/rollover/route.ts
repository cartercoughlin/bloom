import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { calculateRolloverEfficient } from "@/lib/budget/calculate-rollover"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = parseInt(searchParams.get("month") || "", 10)
    const year = parseInt(searchParams.get("year") || "", 10)

    if (!month || !year || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Valid month (1-12) and year are required" },
        { status: 400 }
      )
    }

    const rollover = await calculateRolloverEfficient(supabase, user.id, month, year)
    return NextResponse.json(rollover)
  } catch (error) {
    console.error("Rollover API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
