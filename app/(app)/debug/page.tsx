'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { cache } from '@/lib/capacitor'

export default function DebugPage() {
  const [syncing, setSyncing] = useState(false)
  const [clearingCache, setClearingCache] = useState(false)
  const router = useRouter()

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

  const handleCheckAccounts = async () => {
    try {
      const response = await fetch('/api/connected-accounts')
      const data = await response.json()
      console.log('Connected accounts:', data)
      toast.success(`Found ${data.length} account(s). Check console for details.`)
    } catch (error) {
      console.error('Error fetching accounts:', error)
      toast.error('Failed to fetch accounts')
    }
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl pb-20 md:pb-6">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">🛠️ Debug Tools</h1>

      <div className="space-y-4">
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
              Check what accounts are connected (results in browser console).
            </p>
            <Button
              onClick={handleCheckAccounts}
              variant="outline"
              className="w-full"
            >
              Check Connected Accounts
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-muted">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Pro tip:</strong> If your new account isn't showing up:
              <br />
              1. Click "Sync Transactions" to trigger a full sync
              <br />
              2. Click "Clear All Cache & Reload" to force fresh data
              <br />
              3. Check browser console (F12) for any error messages
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
