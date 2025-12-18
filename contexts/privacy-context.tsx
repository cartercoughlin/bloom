'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface PrivacyContextType {
  privacyMode: boolean
  togglePrivacyMode: () => void
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined)

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [privacyMode, setPrivacyMode] = useState(false)

  // Load privacy mode from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('privacyMode')
    if (stored === 'true') {
      setPrivacyMode(true)
    }
  }, [])

  const togglePrivacyMode = () => {
    setPrivacyMode(prev => {
      const newValue = !prev
      localStorage.setItem('privacyMode', String(newValue))
      return newValue
    })
  }

  return (
    <PrivacyContext.Provider value={{ privacyMode, togglePrivacyMode }}>
      {children}
    </PrivacyContext.Provider>
  )
}

export function usePrivacy() {
  const context = useContext(PrivacyContext)
  if (context === undefined) {
    throw new Error('usePrivacy must be used within a PrivacyProvider')
  }
  return context
}
