import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TransactionsTable } from "@/components/transactions-table"
import { SyncButton } from "@/components/sync-button"

export default async function TransactionsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login")
  }

  // Get transactions with categories
  const { data: transactions } = await supabase
    .from("transactions")
    .select(`
      id,
      date,
      description,
      amount,
      transaction_type,
      bank,
      category_id,
      user_id,
      hidden,
      categories (
        name,
        color,
        icon
      )
    `)
    .eq("user_id", user.id)
    .order("date", { ascending: false })

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("user_id", user.id)
    .order("name")

  console.log('Fetched transactions:', transactions)
  console.log('First transaction:', transactions?.[0])

  return (
    <div className="container mx-auto px-3 sm:px-6 max-w-7xl pb-24 sm:pb-6">
      <div className="flex items-center justify-between mb-4 md:mb-8">
        <div>
          <h1 className="text-xl md:text-3xl font-bold mb-1 md:mb-2">Transactions</h1>
          <p className="text-muted-foreground text-xs md:text-sm">View and manage your transactions</p>
        </div>
        <SyncButton />
      </div>

      <TransactionsTable
        transactions={transactions || []}
        categories={categories || []}
      />
    </div>
  )
}
