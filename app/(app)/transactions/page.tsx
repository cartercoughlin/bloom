import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload } from "lucide-react"
import { TransactionsTable } from "@/components/transactions-table"

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
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Transactions</h1>
          <p className="text-muted-foreground">View and manage your transactions</p>
        </div>
        <Link href="/transactions/import">
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Import Transactions
          </Button>
        </Link>
      </div>

      <TransactionsTable 
        transactions={transactions || []} 
        categories={categories || []}
      />
    </div>
  )
}
