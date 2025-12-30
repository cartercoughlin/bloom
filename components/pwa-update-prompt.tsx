"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

export function PWAUpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Listen for custom update event from service worker registration
    const handleUpdate = () => {
      setShowPrompt(true)
    }

    window.addEventListener('swUpdateAvailable', handleUpdate)

    // Also listen for service worker messages as backup
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SW_UPDATED') {
          setShowPrompt(true)
        }
      })
    }

    return () => {
      window.removeEventListener('swUpdateAvailable', handleUpdate)
    }
  }, [])

  const handleUpdateClick = () => {
    window.location.reload()
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 bg-green-600 text-white p-4 rounded-lg shadow-lg z-50 flex items-center justify-between">
      <span className="text-sm font-medium">🌿 New version available!</span>
      <Button
        onClick={handleUpdateClick}
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
