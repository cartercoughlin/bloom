"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

export function PWAUpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SW_UPDATED') {
          setShowPrompt(true)
        }
      })
    }
  }, [])

  const handleUpdate = () => {
    window.location.reload()
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50 flex items-center justify-between">
      <span className="text-sm">New version available!</span>
      <Button 
        onClick={handleUpdate}
        variant="secondary"
        size="sm"
        className="ml-2"
      >
        <RefreshCw className="h-4 w-4 mr-1" />
        Update
      </Button>
    </div>
  )
}
