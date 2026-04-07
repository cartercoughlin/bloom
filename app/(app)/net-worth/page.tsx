'use client'

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAppData } from "@/contexts/app-data-context"

interface AccountBalance {
  account_name: string
  account_type: string
  balance: number
}

export default function NetWorthPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<AccountBalance[]>([])
  const [loading, setLoading] = useState(true)
  const appData = useAppData()
  const fetchingRef = useRef(false)

  useEffect(() => {
    async function loadData() {
      // Check in-memory cache first
      const cached = appData.get('net-worth')
      if (cached) {
        setAccounts(cached)
        setLoading(false)
        if (!appData.isStale('net-worth')) return
      }

      if (fetchingRef.current) return
      fetchingRef.current = true

      try {
        const response = await fetch('/api/account-balances')
        if (!response.ok) throw new Error('Failed to fetch')
        const data = await response.json()

        // Sort by account type, then balance
        const sorted = (data || []).sort((a: AccountBalance, b: AccountBalance) => {
          if (a.account_type !== b.account_type) {
            return a.account_type.localeCompare(b.account_type)
          }
          return b.balance - a.balance
        })

        setAccounts(sorted)
        appData.set('net-worth', sorted)
      } catch (error) {
        console.error('Error loading net worth data:', error)
      } finally {
        setLoading(false)
        fetchingRef.current = false
      }
    }

    loadData()
  }, [])

  const assets = accounts.filter((a) => a.account_type !== "liability")
  const liabilities = accounts.filter((a) => a.account_type === "liability")
  const totalAssets = assets.reduce((sum, a) => sum + Number(a.balance), 0)
  const totalLiabilities = liabilities.reduce((sum, a) => sum + Math.abs(Number(a.balance)), 0)
  const netWorth = totalAssets - totalLiabilities

  if (loading && accounts.length === 0) {
    return (
      <div className="container mx-auto p-3 md:p-6 max-w-7xl pb-20 md:pb-6">
        <div className="mb-4 md:mb-8">
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <Skeleton className="h-48 w-full mt-6" />
      </div>
    )
  }

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
