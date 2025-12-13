'use client'

import { haptics } from '@/lib/capacitor'

/**
 * Hook to provide haptic feedback functions
 * Automatically handles platform checks
 */
export function useHaptics() {
  return {
    /**
     * Light impact haptic (e.g., UI element selection)
     */
    light: haptics.light,

    /**
     * Medium impact haptic (e.g., button press)
     */
    medium: haptics.medium,

    /**
     * Heavy impact haptic (e.g., important action)
     */
    heavy: haptics.heavy,

    /**
     * Success notification haptic
     */
    success: haptics.success,

    /**
     * Warning notification haptic
     */
    warning: haptics.warning,

    /**
     * Error notification haptic
     */
    error: haptics.error,
  }
}

/**
 * Wrapper component to add haptic feedback to buttons and interactive elements
 */
export function withHaptics<T extends (...args: any[]) => any>(
  callback: T,
  hapticType: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'medium'
): T {
  return ((...args: any[]) => {
    haptics[hapticType]()
    return callback(...args)
  }) as T
}
