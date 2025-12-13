"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface AccountSummaryProps {
  accountBalances: Record<string, number>
  totalAvailable: number
}

export function AccountSummary({ accountBalances, totalAvailable }: AccountSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Balances</CardTitle>
        <CardDescription>
          Synced from Tiller Balances sheet
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Account Breakdown */}
        <div className="space-y-3">
          {Object.entries(accountBalances).map(([account, balance]) => (
            <div key={account} className="flex justify-between items-center p-3 border rounded-lg">
              <span className="font-medium">{account}</span>
              <span className={`font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                ${balance.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Total Available */}
        <div className="pt-4 border-t">
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium">Total Available to Allocate</span>
            <span className="text-xl font-bold text-blue-600">
              ${totalAvailable.toFixed(2)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
