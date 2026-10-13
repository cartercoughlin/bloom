"use client"

import { useCallback, useEffect, useState } from "react"
import type { PacingMode } from "@/lib/budget/pacing"

const STORAGE_KEY = "pacingMode"
const CHANGE_EVENT = "pacing-mode-change"

function readMode(): PacingMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === "history" ? "history" : "even"
  } catch {
    return "even"
  }
}

// Pacing mode chosen on Budgets or the dashboard, remembered per device and
// kept in sync across every component using it
export function usePacingMode(): [PacingMode, (mode: PacingMode) => void] {
  const [mode, setModeState] = useState<PacingMode>("even")

  useEffect(() => {
    setModeState(readMode())
    const onChange = () => setModeState(readMode())
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => window.removeEventListener(CHANGE_EVENT, onChange)
  }, [])

  const setMode = useCallback((next: PacingMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {}
    setModeState(next)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  return [mode, setMode]
}
