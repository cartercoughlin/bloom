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
      const response = await fetch('/api/sync-transactions', {
        method: 'POST',
      })
      
      if (response.ok) {
        router.refresh()
      } else {
        console.error('Sync failed')
      }
    } catch (error) {
      console.error('Sync error:', error)
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
