'use client'

import { useEffect, useRef, useState } from 'react'
import { keyboard, isNativePlatform } from '@/lib/capacitor'

interface UseKeyboardOptions {
  /**
   * Auto-scroll the focused input into view when keyboard appears
   * @default true
   */
  autoScroll?: boolean

  /**
   * Offset from top when auto-scrolling (in pixels)
   * @default 20
   */
  scrollOffset?: number

  /**
   * Callback when keyboard appears
   */
  onKeyboardShow?: () => void

  /**
   * Callback when keyboard hides
   */
  onKeyboardHide?: () => void
}

/**
 * Hook to handle mobile keyboard interactions
 * Automatically scrolls inputs into view and provides keyboard state
 */
export function useKeyboard(options: UseKeyboardOptions = {}) {
  const {
    autoScroll = true,
    scrollOffset = 20,
    onKeyboardShow,
    onKeyboardHide,
  } = options

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isNativePlatform()) return

    // Handle keyboard show
    const removeShowListener = keyboard.onShow(() => {
      setIsKeyboardVisible(true)
      onKeyboardShow?.()

      // Auto-scroll focused input into view
      if (autoScroll) {
        setTimeout(() => {
          const activeElement = document.activeElement as HTMLElement
          if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            const rect = activeElement.getBoundingClientRect()
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop
            const targetY = rect.top + scrollTop - scrollOffset

            window.scrollTo({
              top: targetY,
              behavior: 'smooth'
            })
          }
        }, 100)
      }
    })

    // Handle keyboard hide
    const removeHideListener = keyboard.onHide(() => {
      setIsKeyboardVisible(false)
      onKeyboardHide?.()
    })

    return () => {
      removeShowListener()
      removeHideListener()
    }
  }, [autoScroll, scrollOffset, onKeyboardShow, onKeyboardHide])

  return {
    isKeyboardVisible,
    inputRef,
    hideKeyboard: keyboard.hide,
    showKeyboard: keyboard.show,
  }
}

/**
 * Hook to handle form keyboard interactions
 * Manages submit-on-enter behavior and keyboard dismissal
 */
export function useFormKeyboard(onSubmit?: () => void) {
  const { isKeyboardVisible, hideKeyboard } = useKeyboard()

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      hideKeyboard()
      onSubmit?.()
    }
  }

  return {
    isKeyboardVisible,
    hideKeyboard,
    keyboardProps: {
      onKeyPress: handleKeyPress,
    },
  }
}
