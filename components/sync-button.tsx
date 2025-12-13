"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"

export function SyncButton() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSync = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/sync-sheets', {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Sync result:', data)

        // Show debug info if available
        if (data.debugInfo) {
          console.log('DEBUG INFO:')
          console.log('Row 0:', data.debugInfo.row0)
          console.log('Row 1:', data.debugInfo.row1)
          console.log('Row 2:', data.debugInfo.row2)
          console.log('Row 3:', data.debugInfo.row3)
          alert(`Sync complete!\nTransactions: ${data.newTransactions} new\nAccounts: ${data.syncedAccounts} synced\n\nCheck console for debug info (F12)`)
        } else {
          alert(`Sync complete!\nTransactions: ${data.newTransactions} new\nAccounts: ${data.syncedAccounts || 0} synced`)
        }

        router.refresh()
      } else {
        const error = await response.json()
        console.error('Sync failed:', error)
        alert(`Sync failed: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Sync error:', error)
      alert(`Sync error: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button 
      onClick={handleSync}
      disabled={isLoading}
      className="text-xs md:text-sm h-8 md:h-10 px-3 md:px-4"
    >
      <RefreshCw className={`mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4 ${isLoading ? 'animate-spin' : ''}`} />
      <span className="hidden sm:inline">Sync Transactions</span>
      <span className="sm:hidden">Sync</span>
    </Button>
  )
}
