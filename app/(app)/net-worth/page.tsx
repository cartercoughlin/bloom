import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function NetWorthPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login")
  }

  // Get all account balances
  const { data: accounts } = await supabase
    .from("account_balances")
    .select("account_name, account_type, balance")
    .eq("user_id", user.id)
    .order("account_type", { ascending: true })
    .order("balance", { ascending: false })

  // Calculate totals by type
  let totalAssets = 0
  let totalLiabilities = 0

  const assets = accounts?.filter((a) => a.account_type !== "liability") || []
  const liabilities = accounts?.filter((a) => a.account_type === "liability") || []

  assets.forEach((account) => {
    totalAssets += Number(account.balance)
  })

  liabilities.forEach((account) => {
    totalLiabilities += Math.abs(Number(account.balance))
  })

  const netWorth = totalAssets - totalLiabilities

  return (
    <div className="container mx-auto p-3 md:p-6 max-w-7xl pb-20 md:pb-6">
      <div className="mb-4 md:mb-8">
        <h1 className="text-xl md:text-3xl font-bold mb-1 md:mb-2">Net Worth</h1>
        <p className="text-muted-foreground text-xs md:text-sm">
          Track all your accounts and total net worth
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Assets */}
        <Card>
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="text-green-600 text-base md:text-lg">Assets</CardTitle>
            <CardDescription className="text-xs md:text-sm">Checking, savings, and investment accounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 md:space-y-3 px-3 md:px-6 pb-3 md:pb-6">
            {assets.map((account) => (
              <div
                key={account.account_name}
                className="flex justify-between items-center p-2 md:p-3 border rounded-lg"
              >
                <div>
                  <span className="font-medium text-sm md:text-base">{account.account_name}</span>
                  <span className="text-xs text-muted-foreground ml-2 capitalize">
                    ({account.account_type})
                  </span>
                </div>
                <span className="font-bold text-green-600 text-sm md:text-base">
                  ${Number(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            ))}
            <div className="pt-3 md:pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-base md:text-lg font-medium">Total Assets</span>
                <span className="text-lg md:text-xl font-bold text-green-600">
                  ${totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Liabilities */}
        <Card>
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="text-red-600 text-base md:text-lg">Liabilities</CardTitle>
            <CardDescription className="text-xs md:text-sm">Credit cards and loans</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 md:space-y-3 px-3 md:px-6 pb-3 md:pb-6">
            {liabilities.map((account) => (
              <div
                key={account.account_name}
                className="flex justify-between items-center p-2 md:p-3 border rounded-lg"
              >
                <span className="font-medium text-sm md:text-base">{account.account_name}</span>
                <span className="font-bold text-red-600 text-sm md:text-base">
                  ${Math.abs(Number(account.balance)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            ))}
            <div className="pt-3 md:pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-base md:text-lg font-medium">Total Liabilities</span>
                <span className="text-lg md:text-xl font-bold text-red-600">
                  ${totalLiabilities.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Net Worth Summary */}
      <Card className="mt-6">
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="text-base md:text-lg">Net Worth Summary</CardTitle>
        </CardHeader>
        <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
          <div className="space-y-3 md:space-y-4">
            <div className="flex justify-between items-center p-3 md:p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <span className="text-base md:text-lg font-medium">Total Assets</span>
              <span className="text-lg md:text-xl font-bold text-green-600">
                ${totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 md:p-4 bg-red-50 dark:bg-red-950 rounded-lg">
              <span className="text-base md:text-lg font-medium">Total Liabilities</span>
              <span className="text-lg md:text-xl font-bold text-red-600">
                ${totalLiabilities.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center p-4 md:p-6 bg-blue-50 dark:bg-blue-950 rounded-lg border-2 border-blue-200 dark:border-blue-800">
              <span className="text-xl md:text-2xl font-bold">Net Worth</span>
              <span className="text-2xl md:text-3xl font-bold text-blue-600">
                ${netWorth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
