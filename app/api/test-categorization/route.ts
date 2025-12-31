import { createClient } from "@/lib/supabase/server"
import { suggestCategories } from "@/lib/category-rules"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email') || 'cocoughlin@me.com'
    const date = searchParams.get('date') || '2024-12-18'

    // Find user by email (need admin access for this)
    // For now, let's just use the authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized - please log in" }, { status: 401 })
    }

    console.log(`Testing categorization for user: ${user.email}`)

    // Find uncategorized transactions from the specified date
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .is('category_id', null)
      .gte('date', date)
      .lte('date', date)
      .order('date', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({
        message: `No uncategorized transactions found for ${date}`,
        user: user.email
      })
    }

    // Test categorization on each transaction
    const results = []
    for (const tx of transactions) {
      const suggestions = await suggestCategories(
        tx.id,
        tx.description,
        tx.amount,
        user.id,
        tx.transaction_type,
        tx.bank
      )

      results.push({
        transaction: {
          id: tx.id,
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          type: tx.transaction_type,
          bank: tx.bank
        },
        suggestions: suggestions.map(s => ({
          categoryId: s.categoryId,
          confidence: `${(s.confidence * 100).toFixed(1)}%`,
          reason: s.reason
        }))
      })
    }

    return NextResponse.json({
      user: user.email,
      date,
      transactionCount: transactions.length,
      results
    })
  } catch (error) {
    console.error("Error testing categorization:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
