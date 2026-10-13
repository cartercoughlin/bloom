"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Category, Transaction, displayName, logoFor } from "@/lib/transaction-display"

// Merchant logo, falling back to the category's emoji, then the merchant's initial
export function TransactionAvatar({
  transaction: tx,
  categories,
  size = "md",
}: {
  transaction: Transaction
  categories: Category[]
  size?: "md" | "lg"
}) {
  const [logoFailed, setLogoFailed] = useState(false)
  const logo = logoFor(tx)
  const category = tx.category_id ? categories.find(c => c.id === tx.category_id) : undefined
  const sizeClass = size === "lg" ? "h-14 w-14 text-2xl" : "h-9 w-9 text-base"

  if (logo && !logoFailed) {
    return (
      <img
        src={logo}
        alt=""
        loading="lazy"
        onError={() => setLogoFailed(true)}
        className={cn("rounded-full object-cover flex-shrink-0 bg-muted", sizeClass)}
      />
    )
  }

  const color = category?.color || "#9ca3af"
  return (
    <div
      aria-hidden
      className={cn("rounded-full flex items-center justify-center flex-shrink-0 font-semibold", sizeClass)}
      style={{ backgroundColor: `${color}22`, color }}
    >
      {category?.icon || displayName(tx).trim().charAt(0).toUpperCase()}
    </div>
  )
}
