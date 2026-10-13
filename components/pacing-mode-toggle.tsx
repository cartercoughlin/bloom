"use client"

import { cn } from "@/lib/utils"
import { usePacingMode } from "@/hooks/use-pacing-mode"
import type { PacingMode } from "@/lib/budget/pacing"

const OPTIONS: { value: PacingMode; label: string; title: string }[] = [
  { value: "even", label: "Even", title: "Spread each budget evenly through the month" },
  { value: "history", label: "History", title: "Follow when you usually spend in each category, from every past month" },
]

// Switch how "expected by today" is calculated
export function PacingModeToggle({ className }: { className?: string }) {
  const [mode, setMode] = usePacingMode()

  return (
    <div className={cn("inline-flex items-center gap-2 text-xs", className)}>
      <span className="text-muted-foreground">Pace</span>
      <div className="flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="Pacing">
        {OPTIONS.map(o => (
          <button
            key={o.value}
            role="radio"
            aria-checked={mode === o.value}
            title={o.title}
            onClick={() => setMode(o.value)}
            className={cn(
              "px-2.5 py-1 font-medium rounded-md transition-colors",
              mode === o.value ? "bg-background shadow-sm" : "text-muted-foreground"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
