'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ConnectedAccounts } from '@/components/connected-accounts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp, TrendingDown, EyeOff, Eye } from 'lucide-react'
import { usePrivacy } from '@/contexts/privacy-context'
import { PrivateAmount } from '@/components/private-amount'
import { useAppData } from '@/contexts/app-data-context'

interface AccountBalance {
  account_name: string
  account_type: string
  balance: number
}

interface AccountHistoryPoint {
  month: string
  netWorth: number
  assets: number
  liabilities: number
}

interface SparklineProps {
  data: number[]
  className?: string
}

function Sparkline({ data, className = 'text-muted-foreground' }: SparklineProps) {
  if (data.length < 2) {
    return <div className="h-8 w-20 md:w-24" />
  }

  const width = 96
  const height = 32
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width
      const y = height - ((value - min) / range) * height
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`h-8 w-20 md:w-24 ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export default function AccountsPage() {
  const router = useRouter()
  const [balances, setBalances] = useState<AccountBalance[]>([])
  const [history, setHistory] = useState<AccountHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const { privacyMode, togglePrivacyMode } = usePrivacy()
  const appData = useAppData()
  const fetchingRef = useRef(false)

  const handleLogout = async () => {
    const supabase = createClient()

    // Clear all cached data
    const { cache, storage } = await import('@/lib/capacitor')
    await cache.clear()
    await storage.clear()

    // Clear browser storage (for web)
    if (typeof window !== 'undefined') {
      localStorage.clear()
      sessionStorage.clear()
    }

    // Sign out
    await supabase.auth.signOut()

    // Hard refresh to clear any remaining state
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login'
    } else {
      router.push('/auth/login')
      router.refresh()
    }
  }

  useEffect(() => {
    const loadBalances = async () => {
      // Check in-memory cache first
      const cached = appData.get('accounts')
      const cachedHistory = appData.get('account-history')
      if (cached) {
        setBalances(cached)
        if (cachedHistory) setHistory(cachedHistory)
        setLoading(false)
        if (!appData.isStale('accounts') && cachedHistory && !appData.isStale('account-history')) return
      }

      if (fetchingRef.current) return
      fetchingRef.current = true

      try {
        const [balancesResponse, historyResponse] = await Promise.all([
          fetch('/api/account-balances'),
          fetch('/api/net-worth-history'),
        ])

        if (!balancesResponse.ok) {
          throw new Error('Failed to fetch account balances')
        }

        const data = await balancesResponse.json()

        const sortedData = (data || []).sort((a: AccountBalance, b: AccountBalance) => b.balance - a.balance)
        setBalances(sortedData)
        appData.set('accounts', sortedData)

        if (historyResponse.ok) {
          const historyData = await historyResponse.json()
          setHistory(historyData || [])
          appData.set('account-history', historyData || [])
        }
      } catch (error) {
        console.error('Error loading balances:', error)
      } finally {
        setLoading(false)
        fetchingRef.current = false
      }
    }

    loadBalances()
  }, [])

  const assets = balances.filter(acc => acc.account_type !== 'liability').reduce((sum, acc) => sum + Number(acc.balance), 0)
  const liabilities = balances.filter(acc => acc.account_type === 'liability').reduce((sum, acc) => sum + Math.abs(Number(acc.balance)), 0)
  const totalNetWorth = assets - liabilities
  const recentHistory = history.slice(-6)
  const netWorthSparkline = recentHistory.map(point => point.netWorth)
  const assetsSparkline = recentHistory.map(point => point.assets)
  const liabilitiesSparkline = recentHistory.map(point => point.liabilities)

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl pb-20 md:pb-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl md:text-3xl font-bold">Accounts</h1>
          <div className="flex gap-2">
            <Button
              variant={privacyMode ? "default" : "outline"}
              size="sm"
              onClick={togglePrivacyMode}
              className="gap-2"
            >
              {privacyMode ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              <span className="hidden sm:inline">{privacyMode ? "Show Numbers" : "Hide Numbers"}</span>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <span>🚪</span>
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Logout?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to logout? You'll need to sign in again to access your account.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLogout}>Logout</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
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
              <div className="flex items-end justify-between gap-3">
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
                <Sparkline
                  data={netWorthSparkline}
                  className={`${totalNetWorth >= 0 ? 'text-green-600' : 'text-red-600'} ${privacyMode ? 'blur-sm' : ''}`}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Assets</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-2 md:pb-6">
              <div className="flex items-end justify-between gap-3">
                <PrivateAmount
                  amount={assets}
                  className="text-lg md:text-2xl font-bold text-green-600"
                />
                <Sparkline data={assetsSparkline} className={`text-green-600 ${privacyMode ? 'blur-sm' : ''}`} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Liabilities</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-2 md:pb-6">
              <div className="flex items-end justify-between gap-3">
                <PrivateAmount
                  amount={liabilities}
                  className="text-lg md:text-2xl font-bold text-red-600"
                />
                <Sparkline data={liabilitiesSparkline} className={`text-red-600 ${privacyMode ? 'blur-sm' : ''}`} />
              </div>
            </CardContent>
          </Card>
        </div>

        <ConnectedAccounts />
      </div>
    </div>
  )
}
