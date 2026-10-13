"use client"

import { useEffect, useRef, useState } from "react"
import { RefreshCw } from "lucide-react"
import { haptics } from "@/lib/capacitor"

const THRESHOLD = 70
const MAX_PULL = 110

/**
 * iOS-style pull-to-refresh for touch devices. Pull down from the top of the
 * page past the threshold and release to run `onRefresh`.
 */
export function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<unknown> }) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    let startY: number | null = null
    let current = 0
    let armed = false
    let busy = false

    const onTouchStart = (e: TouchEvent) => {
      if (busy || window.scrollY > 0 || e.touches.length !== 1) return
      startY = e.touches[0].clientY
    }

    const onTouchMove = (e: TouchEvent) => {
      if (startY === null) return
      const delta = e.touches[0].clientY - startY
      if (delta <= 0 || window.scrollY > 0) {
        if (current !== 0) setPull((current = 0))
        return
      }
      e.preventDefault()
      // Rubber-band resistance, like UIScrollView
      current = Math.min(MAX_PULL, delta * 0.5)
      setPull(current)
      if (!armed && current >= THRESHOLD) {
        armed = true
        haptics.light()
      } else if (armed && current < THRESHOLD) {
        armed = false
      }
    }

    const onTouchEnd = async () => {
      if (startY === null) return
      startY = null
      const shouldRefresh = armed
      armed = false
      current = 0
      if (!shouldRefresh) {
        setPull(0)
        return
      }
      busy = true
      setRefreshing(true)
      setPull(THRESHOLD * 0.75)
      try {
        await onRefreshRef.current()
      } finally {
        busy = false
        setRefreshing(false)
        setPull(0)
      }
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true })
    document.addEventListener("touchmove", onTouchMove, { passive: false })
    document.addEventListener("touchend", onTouchEnd)
    document.addEventListener("touchcancel", onTouchEnd)
    return () => {
      document.removeEventListener("touchstart", onTouchStart)
      document.removeEventListener("touchmove", onTouchMove)
      document.removeEventListener("touchend", onTouchEnd)
      document.removeEventListener("touchcancel", onTouchEnd)
    }
  }, [])

  if (pull === 0 && !refreshing) return null

  const progress = Math.min(1, pull / THRESHOLD)
  return (
    <div
      className="flex justify-center overflow-hidden transition-[height] duration-150 ease-out"
      style={{ height: pull }}
      aria-live="polite"
    >
      <RefreshCw
        className={`mt-3 h-5 w-5 text-muted-foreground ${refreshing ? "animate-spin" : ""}`}
        style={{ opacity: progress, transform: refreshing ? undefined : `rotate(${progress * 270}deg)` }}
        aria-label={refreshing ? "Refreshing" : undefined}
      />
    </div>
  )
}
