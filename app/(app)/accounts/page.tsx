'use client'

import { useState, useEffect } from 'react'
import { ConnectedAccounts } from '@/components/connected-accounts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp, TrendingDown, EyeOff, Eye } from 'lucide-react'
import { usePrivacy } from '@/contexts/privacy-context'
import { PrivateAmount } from '@/components/private-amount'

interface AccountBalance {
  account_name: string
  account_type: string
  balance: number
}

export default function AccountsPage() {
  const [balances, setBalances] = useState<AccountBalance[]>([])
  const [loading, setLoading] = useState(true)
  const { privacyMode, togglePrivacyMode } = usePrivacy()

  useEffect(() => {
    const loadBalances = async () => {
      try {
        // Use the API endpoint which has proper filtering logic
        const response = await fetch('/api/account-balances')
        if (!response.ok) {
          throw new Error('Failed to fetch account balances')
        }
        const data = await response.json()

        // Sort by balance descending
        const sortedData = (data || []).sort((a: AccountBalance, b: AccountBalance) => b.balance - a.balance)
        setBalances(sortedData)
      } catch (error) {
        console.error('Error loading balances:', error)
      } finally {
        setLoading(false)
      }
    }

    loadBalances()
  }, [])

  const totalNetWorth = balances.reduce((sum, account) => sum + account.balance, 0)
  const assets = balances.filter(acc => acc.balance > 0).reduce((sum, acc) => sum + acc.balance, 0)
  const liabilities = Math.abs(balances.filter(acc => acc.balance < 0).reduce((sum, acc) => sum + acc.balance, 0))

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl pb-20 md:pb-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl md:text-3xl font-bold">Accounts</h1>
          <Button
            variant={privacyMode ? "default" : "outline"}
            size="sm"
            onClick={togglePrivacyMode}
            className="gap-2"
          >
            {privacyMode ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            <span className="hidden sm:inline">{privacyMode ? "Show Numbers" : "Hide Numbers"}</span>
          </Button>
        </div>
        <p className="text-muted-foreground">
          Manage your connected bank accounts and view your net worth
        </p>
      </div>

      <div className="space-y-6">
        {/* Net Worth Summary */}
        <div className="grid gap-3 md:grid-cols-3 md:gap-4">
          <Card>
            <CardHeader className="pb-1 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Net Worth</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-2 md:pb-6">
              <div className="flex items-center gap-1 md:gap-2">
                {totalNetWorth >= 0 ? (
                  <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 md:h-4 md:w-4 text-red-600" />
                )}
                <PrivateAmount
                  amount={totalNetWorth}
                  className={`text-lg md:text-2xl font-bold ${totalNetWorth >= 0 ? 'text-green-600' : 'text-red-600'}`}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Assets</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-2 md:pb-6">
              <PrivateAmount
                amount={assets}
                className="text-lg md:text-2xl font-bold text-green-600"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Liabilities</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-2 md:pb-6">
              <PrivateAmount
                amount={liabilities}
                className="text-lg md:text-2xl font-bold text-red-600"
              />
            </CardContent>
          </Card>
        </div>

        <ConnectedAccounts />
      </div>
    </div>
  )
}
