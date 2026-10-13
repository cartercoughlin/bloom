"use client"

import { useState } from "react"
import { Check, Pencil, X } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PrivateAmount } from "@/components/private-amount"
import { cn } from "@/lib/utils"

export interface AccountRowData {
  id: string
  account_name: string // what the app shows: custom name if set
  original_name?: string // name from the bank
  custom_name?: string | null
  account_type: string
  balance: number
}

// One account on the Net Worth page, renamable in place
export function AccountRow({
  account,
  onRenamed,
}: {
  account: AccountRowData
  onRenamed: (account: AccountRowData) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(account.account_name)
  const [saving, setSaving] = useState(false)
  const isLiability = account.account_type === "liability"
  const originalName = account.original_name || account.account_name
  const renamed = !!account.custom_name && account.custom_name !== originalName

  const startEditing = () => {
    setName(account.account_name)
    setEditing(true)
  }

  const save = async () => {
    const trimmed = name.trim()
    if (trimmed === account.account_name) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/account-balances/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Clearing the name (or typing the bank's name) goes back to the bank's name
        body: JSON.stringify({ custom_name: trimmed && trimmed !== originalName ? trimmed : null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Couldn't rename account")
      onRenamed({
        ...account,
        custom_name: json.custom_name,
        account_name: json.custom_name || originalName,
      })
      setEditing(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't rename account")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 p-2 md:p-3 border rounded-lg">
      {editing ? (
        <form
          className="flex flex-1 items-center gap-1 min-w-0"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <Input
            autoFocus
            value={name}
            maxLength={60}
            placeholder={originalName}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setEditing(false) }}
            className="h-8 text-sm"
            aria-label={`Name for ${originalName}`}
          />
          <Button type="submit" size="sm" variant="ghost" className="h-8 w-8 p-0" disabled={saving} aria-label="Save name">
            <Check className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditing(false)} aria-label="Cancel">
            <X className="h-4 w-4" />
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={startEditing}
          className="group flex flex-1 items-center gap-1.5 min-w-0 text-left"
          aria-label={`Rename ${account.account_name}`}
        >
          <div className="min-w-0">
            <p className="font-medium text-sm md:text-base truncate">
              {account.account_name}
              {!isLiability && (
                <span className="text-xs font-normal text-muted-foreground ml-2 capitalize">({account.account_type})</span>
              )}
            </p>
            {renamed && <p className="text-[11px] text-muted-foreground truncate">{originalName}</p>}
          </div>
          <Pencil className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100" />
        </button>
      )}
      {!editing && (
        <PrivateAmount
          amount={Math.abs(Number(account.balance))}
          className={cn("font-bold text-sm md:text-base flex-shrink-0", isLiability ? "text-red-600" : "text-green-600")}
        />
      )}
    </div>
  )
}
