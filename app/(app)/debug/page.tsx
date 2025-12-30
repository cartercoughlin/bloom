'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { cache } from '@/lib/capacitor'

export default function DebugPage() {
  const [syncing, setSyncing] = useState(false)
  const [clearingCache, setClearingCache] = useState(false)
  const [checking, setChecking] = useState(false)
  const [accountInfo, setAccountInfo] = useState<any>(null)
  const router = useRouter()

  // Load account info on mount
  useEffect(() => {
    handleCheckAccounts(true)
  }, [])

  const handleForceSyncTransactions = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/sync-transactions', {
        method: 'POST',
      })

      const data = await response.json()
      console.log('Sync result:', data)

      if (data.success) {
        toast.success(`✅ Synced! New: ${data.newTransactions}, Updated: ${data.updatedTransactions}, Total: ${data.totalProcessed}`)
        await handleCheckAccounts(true)
        router.refresh()
      } else {
        toast.error(`❌ Sync failed: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Sync error:', error)
      toast.error('Failed to sync transactions')
    } finally {
      setSyncing(false)
    }
  }

  const handleForceSyncBalances = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/sync-balances', {
        method: 'POST',
      })

      const data = await response.json()
      console.log('Balance sync result:', data)

      if (response.ok) {
        toast.success(`✅ Balances synced!`)
        await handleCheckAccounts(true)
        router.refresh()
      } else {
        toast.error(`❌ Balance sync failed: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Balance sync error:', error)
      toast.error('Failed to sync balances')
    } finally {
      setSyncing(false)
    }
  }

  const handleClearCache = async () => {
    setClearingCache(true)
    try {
      await cache.remove('transactions-page')
      await cache.remove('dashboard-data')
      await cache.removePattern('dashboard-')
      await cache.removePattern('budgets-')

      toast.success('✅ Cache cleared! Refreshing...')
      setTimeout(() => {
        router.refresh()
        window.location.reload()
      }, 500)
    } catch (error) {
      console.error('Cache clear error:', error)
      toast.error('Failed to clear cache')
      setClearingCache(false)
    }
  }

  const handleCheckAccounts = async (silent = false) => {
    if (!silent) setChecking(true)
    try {
      const [accountsRes, balancesRes] = await Promise.all([
        fetch('/api/connected-accounts'),
        fetch('/api/account-balances')
      ])

      const accounts = await accountsRes.json()
      const balances = await balancesRes.json()

      console.log('Connected accounts:', accounts)
      console.log('Account balances:', balances)

      setAccountInfo({
        connectedAccounts: accounts.length,
        accountsWithBalances: balances.length,
        totalBalance: balances.reduce((sum: number, acc: any) => sum + Number(acc.balance), 0),
        accounts,
        balances
      })

      if (!silent) {
        toast.success(`Found ${accounts.length} account(s), ${balances.length} balances. Check console for details.`)
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
      if (!silent) {
        toast.error('Failed to fetch accounts')
      }
    } finally {
      if (!silent) setChecking(false)
    }
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl pb-20 md:pb-6">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">🛠️ Debug Tools</h1>

      <div className="space-y-4">
        {accountInfo && (
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="text-blue-600 dark:text-blue-400">Account Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Connected Accounts:</span>
                <span>{accountInfo.connectedAccounts}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-medium">Accounts with Balances:</span>
                <span className={accountInfo.accountsWithBalances === 0 ? 'text-red-600 font-bold' : ''}>
                  {accountInfo.accountsWithBalances}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-medium">Total Balance:</span>
                <span className="font-bold">
                  ${accountInfo.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {accountInfo.accountsWithBalances === 0 && accountInfo.connectedAccounts > 0 && (
                <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded text-xs">
                  <p className="font-bold text-yellow-800 dark:text-yellow-200">⚠️ No balances found!</p>
                  <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                    Your accounts are connected but have no balance data. Click "Sync Balances" below to fix this.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Force Sync</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Use these buttons to manually trigger syncing, even in PWA mode.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleForceSyncTransactions}
                disabled={syncing}
                className="w-full"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                Sync Transactions
              </Button>
              <Button
                onClick={handleForceSyncBalances}
                disabled={syncing}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                Sync Balances
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cache Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Clear cached data and force a fresh load from the database.
            </p>
            <Button
              onClick={handleClearCache}
              disabled={clearingCache}
              variant="destructive"
              className="w-full"
            >
              {clearingCache ? 'Clearing...' : 'Clear All Cache & Reload'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Diagnostics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Refresh account status and check database (results in browser console).
            </p>
            <Button
              onClick={() => handleCheckAccounts(false)}
              disabled={checking}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
              Refresh Account Status
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-muted">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Pro tip:</strong> If your new account isn't showing up with balances:
              <br />
              1. Click "Sync Balances" to fetch account balance data
              <br />
              2. Click "Sync Transactions" to get transaction history
              <br />
              3. Click "Clear All Cache & Reload" to force fresh data
              <br />
              4. Check browser console (F12) for any error messages
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
