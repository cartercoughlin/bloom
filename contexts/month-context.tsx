"use client"

import { createContext, useContext, useState, useEffect } from "react"

interface MonthContextType {
  selectedMonth: number
  selectedYear: number
  setSelectedMonth: (month: number) => void
  setSelectedYear: (year: number) => void
  goToPreviousMonth: () => void
  goToNextMonth: () => void
  isCurrentMonth: () => boolean
  resetToCurrentMonth: () => void
}

const MonthContext = createContext<MonthContextType | undefined>(undefined)

export function MonthProvider({ children }: { children: React.ReactNode }) {
  const today = new Date()
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())

  const goToPreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12)
      setSelectedYear(selectedYear - 1)
    } else {
      setSelectedMonth(selectedMonth - 1)
    }
  }

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1)
      setSelectedYear(selectedYear + 1)
    } else {
      setSelectedMonth(selectedMonth + 1)
    }
  }

  const isCurrentMonth = () => {
    const now = new Date()
    return selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear()
  }

  const resetToCurrentMonth = () => {
    const now = new Date()
    setSelectedMonth(now.getMonth() + 1)
    setSelectedYear(now.getFullYear())
  }

  return (
    <MonthContext.Provider
      value={{
        selectedMonth,
        selectedYear,
        setSelectedMonth,
        setSelectedYear,
        goToPreviousMonth,
        goToNextMonth,
        isCurrentMonth,
        resetToCurrentMonth,
      }}
    >
      {children}
    </MonthContext.Provider>
  )
}

export function useMonth() {
  const context = useContext(MonthContext)
  if (!context) {
    throw new Error("useMonth must be used within a MonthProvider")
  }
  return context
}
