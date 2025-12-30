'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cache, isBrowserOnly } from '@/lib/capacitor'

export function SyncButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [showButton, setShowButton] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Only show sync button in regular web browser
    // (not in PWA or mobile app where auto-sync handles it)
    setShowButton(isBrowserOnly())
  }, [])

  const handleSync = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/sync-transactions', {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Sync result:', data)

        if (data.success) {
          toast.success(`Synced ${data.newTransactions} new transactions`)
          
          // Clear cached data
          await cache.remove('transactions-page')
          await cache.remove('dashboard-data')
          
          router.refresh()
        } else {
          toast.error(data.error || 'Sync failed')
        }
      } else {
        const error = await response.json()
        console.error('Sync failed:', error)
        toast.error(error.error || 'Failed to sync transactions')
      }
    } catch (error) {
      console.error('Sync error:', error)
      toast.error('Failed to sync transactions')
    } finally {
      setIsLoading(false)
    }
  }

  // Don't render button on mobile/PWA
  if (!showButton) {
    return null
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
