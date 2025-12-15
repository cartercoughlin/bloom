"use client"

import { useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"

export function PullToRefresh() {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [startY, setStartY] = useState(0)

  useEffect(() => {
    let touchStartY = 0
    let touchCurrentY = 0
    let isAtTop = false

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        isAtTop = true
        touchStartY = e.touches[0].clientY
        setStartY(touchStartY)
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isAtTop || isRefreshing) return

      touchCurrentY = e.touches[0].clientY
      const pullDistance = Math.max(0, touchCurrentY - touchStartY)

      if (pullDistance > 0) {
        e.preventDefault()
        setPullDistance(Math.min(pullDistance, 100))
      }
    }

    const handleTouchEnd = () => {
      if (!isAtTop || isRefreshing) return

      if (pullDistance > 60) {
        setIsRefreshing(true)
        // Refresh the page
        setTimeout(() => {
          window.location.reload()
        }, 500)
      }

      setPullDistance(0)
      isAtTop = false
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: false })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd)

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [pullDistance, isRefreshing])

  if (pullDistance === 0 && !isRefreshing) return null

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm transition-all duration-200"
      style={{ 
        height: `${Math.max(pullDistance, isRefreshing ? 60 : 0)}px`,
        transform: `translateY(-${Math.max(60 - pullDistance, 0)}px)`
      }}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <RefreshCw 
          className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`}
          style={{ 
            transform: `rotate(${pullDistance * 3.6}deg)` 
          }}
        />
        <span className="text-sm">
          {isRefreshing ? 'Refreshing...' : pullDistance > 60 ? 'Release to refresh' : 'Pull to refresh'}
        </span>
      </div>
    </div>
  )
}
