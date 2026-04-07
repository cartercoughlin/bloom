"use client"

import { memo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { usePrivacy } from "@/contexts/privacy-context"

interface Account {
  account_name: string
  account_type: string
  balance: number
}

interface NetWorthCardProps {
  accounts: Account[]
}

function formatCurrency(value: number) {
  return `$${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function NetWorthCardInner({ accounts }: NetWorthCardProps) {
  const { privacyMode } = usePrivacy()
  const masked = "••••••"

  const assets = accounts.filter((a) => a.account_type !== "liability")
  const liabilities = accounts.filter((a) => a.account_type === "liability")
  const totalAssets = assets.reduce((sum, a) => sum + Number(a.balance), 0)
  const totalLiabilities = liabilities.reduce((sum, a) => sum + Math.abs(Number(a.balance)), 0)
  const netWorth = totalAssets - totalLiabilities

  if (accounts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="text-base md:text-lg">Net Worth</CardTitle>
          <CardDescription className="text-xs md:text-sm">Your total net worth</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48 md:h-64">
          <p className="text-muted-foreground text-xs md:text-sm">No accounts linked yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3 md:pb-6">
        <CardTitle className="text-base md:text-lg">Net Worth</CardTitle>
        <CardDescription className="text-xs md:text-sm">Current account balances</CardDescription>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pb-4 md:pb-6 space-y-4">
        {/* Net Worth Hero */}
        <div className="text-center py-3 md:py-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-muted-foreground mb-1">Total Net Worth</p>
          <p className={`text-2xl md:text-3xl font-bold ${netWorth >= 0 ? "text-blue-600" : "text-red-600"}`}>
            {privacyMode ? masked : formatCurrency(netWorth)}
          </p>
        </div>

        {/* Assets / Liabilities Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Assets</p>
            <p className="text-sm md:text-base font-semibold text-green-600">
              {privacyMode ? masked : formatCurrency(totalAssets)}
            </p>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Liabilities</p>
            <p className="text-sm md:text-base font-semibold text-red-600">
              {privacyMode ? masked : formatCurrency(totalLiabilities)}
            </p>
          </div>
        </div>

        {/* Account List */}
        <div className="space-y-1.5">
          {assets.map((acc) => (
            <div key={acc.account_name} className="flex justify-between items-center text-sm px-1">
              <span className="text-muted-foreground truncate mr-2">{acc.account_name}</span>
              <span className="font-medium text-green-600 whitespace-nowrap">
                {privacyMode ? masked : formatCurrency(Number(acc.balance))}
              </span>
            </div>
          ))}
          {liabilities.map((acc) => (
            <div key={acc.account_name} className="flex justify-between items-center text-sm px-1">
              <span className="text-muted-foreground truncate mr-2">{acc.account_name}</span>
              <span className="font-medium text-red-600 whitespace-nowrap">
                -{privacyMode ? masked : formatCurrency(Math.abs(Number(acc.balance)))}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export const MonthlyTrend = memo(NetWorthCardInner)
