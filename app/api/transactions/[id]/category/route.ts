import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.error('No user found')
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { categoryId } = await request.json()
    const transactionId = params.id

    // Validate transactionId is not undefined/null string
    if (!transactionId || transactionId === 'undefined' || transactionId === 'null') {
      console.error('Invalid transaction ID:', transactionId)
      return NextResponse.json({ error: "Invalid transaction ID" }, { status: 400 })
    }

    // Validate categoryId is not undefined/null string
    const validCategoryId = (categoryId === 'undefined' || categoryId === 'null' || categoryId === '') ? null : categoryId

    console.log('Updating transaction:', transactionId, 'for user:', user.id, 'with category:', validCategoryId)

    const { data, error } = await supabase
      .from("transactions")
      .update({
        category_id: validCategoryId
      })
      .eq("id", transactionId)
      .eq("user_id", user.id)
      .select()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.log('Update successful:', data)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
