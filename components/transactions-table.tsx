"use client"

import { useState, useMemo, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Filter, X, Upload, EyeOff, Eye, Repeat, AlertCircle, ChevronDown, ChevronUp, Search, ListChecks } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { CategoryPicker } from "./category-picker"
import { TransactionDetails } from "./transaction-details"
import { TransactionAvatar } from "./transaction-avatar"
import Link from "next/link"
import { PrivateAmount } from "./private-amount"
import { cn } from "@/lib/utils"
import { haptics } from "@/lib/capacitor"
import {
  Category,
  Transaction,
  accountLabel,
  displayName,
  locationLabel,
  parseLocalDate,
} from "@/lib/transaction-display"

export type { Category, Transaction } from "@/lib/transaction-display"

interface TransactionsTableProps {
  transactions: Transaction[]
  categories: Category[]
  onTransactionsChange: (updater: (transactions: Transaction[]) => Transaction[]) => void
  onCategoriesChange: (updater: (categories: Category[]) => Category[]) => void
  // Called after any edit that changes budget/dashboard numbers
  onBudgetDataChanged: () => void
}

// Transactions from the same merchant, used for "apply to similar"
function merchantKey(tx: Transaction): string {
  return (tx.merchant_name || tx.description).trim().toLowerCase()
}

async function bulkUpdate(transactionIds: string[], updates: { categoryId?: string | null; hidden?: boolean }) {
  const response = await fetch("/api/transactions/bulk", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactionIds, ...updates }),
  })
  if (!response.ok) {
    const result = await response.json().catch(() => ({}))
    throw new Error(result.error || "Update failed")
  }
}

export function TransactionsTable({
  transactions,
  categories,
  onTransactionsChange,
  onCategoriesChange,
  onBudgetDataChanged,
}: TransactionsTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<Date>()
  const [dateTo, setDateTo] = useState<Date>()
  const [amountMin, setAmountMin] = useState("")
  const [amountMax, setAmountMax] = useState("")
  const [showHidden, setShowHidden] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showUncategorized, setShowUncategorized] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('showUncategorized')
      return saved !== null ? saved === 'true' : true
    }
    return true
  })
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)
  const [visibleDays, setVisibleDays] = useState(14)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    try {
      localStorage.setItem('showUncategorized', String(showUncategorized))
    } catch {}
  }, [showUncategorized])

  // Derive from the list so the detail modal always reflects the latest edit
  const selectedTransaction = useMemo(
    () => transactions.find(tx => tx.id === selectedTransactionId) || null,
    [transactions, selectedTransactionId]
  )

  const categoriesById = useMemo(
    () => new Map(categories.map(c => [c.id, c])),
    [categories]
  )

  const filteredTransactions = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()
    const min = amountMin ? parseFloat(amountMin) : null
    const max = amountMax ? parseFloat(amountMax) : null

    return transactions.filter((tx) => {
      if (tx.hidden && !showHidden) return false

      if (search) {
        const categoryName = tx.category_id ? categoriesById.get(tx.category_id)?.name : ""
        const haystack = [tx.description, tx.merchant_name, tx.bank, tx.account_name, categoryName, tx.plaid_details?.location?.city]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(search)) return false
      }

      if (categoryFilter !== "all") {
        if (categoryFilter === "uncategorized" && tx.category_id) return false
        if (categoryFilter !== "uncategorized" && tx.category_id !== categoryFilter) return false
      }

      if (typeFilter !== "all" && tx.transaction_type !== typeFilter) return false

      const txDate = parseLocalDate(tx.date)
      if (dateFrom && txDate < dateFrom) return false
      if (dateTo && txDate > dateTo) return false

      if (min !== null && tx.amount < min) return false
      if (max !== null && tx.amount > max) return false

      return true
    })
  }, [transactions, categoriesById, searchTerm, categoryFilter, typeFilter, dateFrom, dateTo, amountMin, amountMax, showHidden])

  const uncategorizedTransactions = useMemo(
    () => filteredTransactions.filter(tx => !tx.category_id && !tx.hidden),
    [filteredTransactions]
  )

  // Group by date, excluding uncategorized (shown in their own section)
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {}
    for (const tx of filteredTransactions) {
      if (!tx.category_id && !tx.hidden) continue
      ;(groups[tx.date] ||= []).push(tx)
    }
    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map(date => ({ date, transactions: groups[date] }))
  }, [filteredTransactions])

  const applyLocal = (ids: Set<string>, patch: (tx: Transaction) => Transaction) => {
    onTransactionsChange(prev => prev.map(tx => (ids.has(tx.id) ? patch(tx) : tx)))
  }

  // Optimistically assign a category, rolling back if the server rejects it
  const assignCategory = async (ids: string[], categoryId: string | null, newCategory?: Category) => {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    const previous = new Map(
      transactions.filter(tx => idSet.has(tx.id)).map(tx => [tx.id, { category_id: tx.category_id, categories: tx.categories }])
    )
    const category = categoryId ? (newCategory || categoriesById.get(categoryId)) : undefined
    const joined = category ? { name: category.name, color: category.color, icon: category.icon } : null

    applyLocal(idSet, tx => ({ ...tx, category_id: categoryId, categories: joined }))

    try {
      await bulkUpdate(ids, { categoryId })
    } catch (error) {
      onTransactionsChange(prev => prev.map(tx => {
        const before = previous.get(tx.id)
        return before ? { ...tx, ...before } : tx
      }))
      haptics.error()
      toast.error(error instanceof Error ? error.message : "Failed to update category")
      return false
    }

    if (ids.length === 1) haptics.light()
    else haptics.success()
    onBudgetDataChanged()

    // Teach the auto-categorizer from single, deliberate assignments
    if (categoryId && ids.length === 1) {
      fetch("/api/category-learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: ids[0], categoryId }),
      }).catch(() => {})
    }
    return true
  }

  // After categorizing one transaction, offer to apply it to the rest from that merchant
  const handleSingleCategorize = async (tx: Transaction, categoryId: string | null, newCategory?: Category) => {
    const ok = await assignCategory([tx.id], categoryId, newCategory)
    if (!ok || !categoryId) return

    const key = merchantKey(tx)
    const similar = transactions.filter(other =>
      other.id !== tx.id && !other.category_id && !other.hidden && merchantKey(other) === key
    )
    if (similar.length === 0) return

    const category = newCategory || categoriesById.get(categoryId)
    toast(`${similar.length} more from ${displayName(tx)}`, {
      description: `Categorize ${similar.length === 1 ? "it" : "them"} as ${category?.name ?? "this category"} too?`,
      duration: 8000,
      action: {
        label: "Apply",
        onClick: async () => {
          if (await assignCategory(similar.map(s => s.id), categoryId, newCategory)) {
            toast.success(`Categorized ${similar.length} more transaction${similar.length === 1 ? "" : "s"}`)
          }
        },
      },
    })
  }

  const setHidden = async (ids: string[], hidden: boolean) => {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    const previous = new Map(transactions.filter(tx => idSet.has(tx.id)).map(tx => [tx.id, tx.hidden]))
    applyLocal(idSet, tx => ({ ...tx, hidden }))
    try {
      await bulkUpdate(ids, { hidden })
      onBudgetDataChanged()
    } catch (error) {
      onTransactionsChange(prev => prev.map(tx => (previous.has(tx.id) ? { ...tx, hidden: previous.get(tx.id) } : tx)))
      toast.error("Failed to update transaction visibility")
    }
  }

  const handleToggleRecurring = async (tx: Transaction) => {
    const recurring = !tx.recurring
    const idSet = new Set([tx.id])
    applyLocal(idSet, t => ({ ...t, recurring }))
    try {
      const response = await fetch(`/api/transactions/${tx.id}/recurring`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recurring }),
      })
      if (!response.ok) throw new Error()
      onBudgetDataChanged()
    } catch {
      applyLocal(idSet, t => ({ ...t, recurring: !recurring }))
      toast.error("Failed to update recurring status")
    }
  }

  const handleDeleteTransaction = async (transactionId: string) => {
    try {
      const response = await fetch(`/api/transactions/${transactionId}`, { method: "DELETE" })
      if (!response.ok) throw new Error()
      haptics.warning()
      onTransactionsChange(prev => prev.filter(tx => tx.id !== transactionId))
      setSelectedTransactionId(null)
      onBudgetDataChanged()
    } catch {
      toast.error("Failed to delete transaction")
    }
  }

  const handleCategoryCreated = (category: Category) => {
    onCategoriesChange(prev => [...prev, category].sort((a, b) => a.name.localeCompare(b.name)))
  }

  const toggleSelected = (id: string) => {
    haptics.light()
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const handleRowClick = (tx: Transaction) => {
    if (selectMode) toggleSelected(tx.id)
    else setSelectedTransactionId(tx.id)
  }

  const allUncategorizedSelected =
    uncategorizedTransactions.length > 0 && uncategorizedTransactions.every(tx => selectedIds.has(tx.id))

  const clearFilters = () => {
    setSearchTerm("")
    setCategoryFilter("all")
    setTypeFilter("all")
    setDateFrom(undefined)
    setDateTo(undefined)
    setAmountMin("")
    setAmountMax("")
    setShowHidden(false)
  }

  const hasActiveFilters = searchTerm || categoryFilter !== "all" || typeFilter !== "all" ||
                          dateFrom || dateTo || amountMin || amountMax || showHidden

  if (transactions.length === 0) {
    return (
      <div className="sm:bg-card sm:border sm:rounded-lg">
        <div className="flex flex-col items-center justify-center py-12 md:py-16 px-6">
          <Upload className="h-8 w-8 md:h-12 md:w-12 text-muted-foreground mb-3 md:mb-4" />
          <h3 className="text-base md:text-lg font-semibold mb-1 md:mb-2">No transactions yet</h3>
          <p className="text-muted-foreground text-center text-xs md:text-sm mb-4 md:mb-6">Import your first transactions to get started</p>
          <Link href="/transactions/import">
            <Button className="text-xs md:text-sm h-8 md:h-10 bg-gradient-fern hover:bg-gradient-fern-light">
              <Upload className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
              Import Transactions
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const renderRow = (tx: Transaction, showDate: boolean) => (
    <TransactionRow
      key={tx.id}
      tx={tx}
      categories={categories}
      showDate={showDate}
      selectMode={selectMode}
      selected={selectedIds.has(tx.id)}
      onClick={() => handleRowClick(tx)}
      onCategorize={(categoryId, created) => handleSingleCategorize(tx, categoryId, created)}
      onCategoryCreated={handleCategoryCreated}
    />
  )

  return (
    <div className={cn("sm:bg-card sm:border sm:rounded-lg", selectMode && "pb-24")}>
      <div className="p-2 sm:p-4 border-b sm:border-b-border border-b-transparent">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search merchant, bank, or category"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 pr-8 text-sm"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="text-xs h-8 px-2"
            aria-label="Filters"
          >
            <Filter className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Filters</span>
          </Button>
          <Button
            variant={selectMode ? "secondary" : "outline"}
            size="sm"
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            className="text-xs h-8 px-2"
            aria-label={selectMode ? "Done selecting" : "Select transactions"}
          >
            <ListChecks className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">{selectMode ? "Done" : "Select"}</span>
          </Button>
        </div>

        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-muted-foreground">
            {filteredTransactions.length} of {transactions.length}
          </p>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-6 px-2">
              <X className="mr-1 h-3 w-3" />
              Clear filters
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="space-y-3 mt-3 p-4 bg-card rounded-lg border-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="text-xs md:text-sm h-8 md:h-10">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="uncategorized">Uncategorized</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="text-xs md:text-sm h-8 md:h-10">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="credit">Income</SelectItem>
                  <SelectItem value="debit">Expense</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Input
                  placeholder="Min amount"
                  type="number"
                  inputMode="decimal"
                  value={amountMin}
                  onChange={(e) => setAmountMin(e.target.value)}
                  className="text-xs md:text-sm h-8 md:h-10"
                />
                <Input
                  placeholder="Max amount"
                  type="number"
                  inputMode="decimal"
                  value={amountMax}
                  onChange={(e) => setAmountMax(e.target.value)}
                  className="text-xs md:text-sm h-8 md:h-10"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs md:text-sm h-7 md:h-9 px-2 md:px-3">
                    <CalendarIcon className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
                    {dateFrom ? format(dateFrom, "MMM dd") : "From date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs md:text-sm h-7 md:h-9 px-2 md:px-3">
                    <CalendarIcon className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
                    {dateTo ? format(dateTo, "MMM dd") : "To date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                </PopoverContent>
              </Popover>

              <Button
                variant={showHidden ? "default" : "outline"}
                size="sm"
                onClick={() => setShowHidden(!showHidden)}
                className="text-xs md:text-sm h-7 md:h-9 px-2 md:px-3"
              >
                {showHidden ? <Eye className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" /> : <EyeOff className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />}
                {showHidden ? "Showing hidden" : "Show hidden"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="sm:p-4 p-0">
        {uncategorizedTransactions.length > 0 && (
          <div className="mb-6 p-3 sm:p-4 bg-muted/50 border border-border rounded-lg">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="flex items-center gap-2 flex-1 text-left"
                onClick={() => setShowUncategorized(!showUncategorized)}
              >
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">
                  Needs Categorization ({uncategorizedTransactions.length})
                </h3>
                {showUncategorized ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
              </button>
              {selectMode && showUncategorized && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setSelectedIds(prev => {
                    const next = new Set(prev)
                    for (const tx of uncategorizedTransactions) {
                      if (allUncategorizedSelected) next.delete(tx.id)
                      else next.add(tx.id)
                    }
                    return next
                  })}
                >
                  {allUncategorizedSelected ? "Deselect all" : "Select all"}
                </Button>
              )}
            </div>

            {showUncategorized && (
              <>
                <p className="text-xs text-muted-foreground mt-2 mb-3">
                  {selectMode
                    ? "Tap transactions to select them, then categorize them all at once."
                    : "Assign categories to include these in your budget tracking."}
                </p>
                <div className="space-y-2">
                  {uncategorizedTransactions.map(tx => renderRow(tx, true))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="w-full space-y-4">
          {groupedTransactions.slice(0, visibleDays).map(({ date, transactions: dayTransactions }) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className="text-sm md:text-base font-medium text-muted-foreground">
                  {parseLocalDate(date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
                <div className="flex-1 h-px bg-border"></div>
              </div>

              <div className="space-y-2">
                {dayTransactions.map(tx => renderRow(tx, false))}
              </div>
            </div>
          ))}

          {groupedTransactions.length > visibleDays && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleDays(prev => prev + 14)}
                className="text-xs md:text-sm"
              >
                Show more ({groupedTransactions.length - visibleDays} days remaining)
              </Button>
            </div>
          )}

          {groupedTransactions.length === 0 && uncategorizedTransactions.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No transactions found</p>
            </div>
          )}
        </div>
      </div>

      {/* Bulk actions */}
      {selectMode && (
        <div className="fixed left-4 right-4 bottom-[calc(58px+env(safe-area-inset-bottom))] md:bottom-6 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[32rem] z-40 rounded-xl border bg-background shadow-lg p-2 flex items-center gap-2">
          <span className="text-sm font-medium px-2 flex-1">
            {selectedIds.size} selected
          </span>
          <CategoryPicker
            categories={categories}
            label="Categorize"
            onSelect={async (categoryId, created) => {
              const ids = [...selectedIds]
              if (await assignCategory(ids, categoryId, created)) {
                toast.success(`Updated ${ids.length} transaction${ids.length === 1 ? "" : "s"}`)
                exitSelectMode()
              }
            }}
            onCategoryCreated={handleCategoryCreated}
            className={cn("h-8", selectedIds.size === 0 && "pointer-events-none opacity-50")}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={selectedIds.size === 0}
            onClick={async () => {
              await setHidden([...selectedIds], true)
              exitSelectMode()
            }}
          >
            <EyeOff className="h-3 w-3 mr-1" />
            Hide
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={exitSelectMode} aria-label="Exit selection">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <TransactionDetails
        transaction={selectedTransaction}
        categories={categories}
        onClose={() => setSelectedTransactionId(null)}
        onCategorize={handleSingleCategorize}
        onCategoryCreated={handleCategoryCreated}
        onToggleRecurring={handleToggleRecurring}
        onToggleHidden={(tx) => setHidden([tx.id], !tx.hidden)}
        onDelete={(tx) => handleDeleteTransaction(tx.id)}
      />
    </div>
  )
}

function TransactionRow({
  tx,
  categories,
  showDate,
  selectMode,
  selected,
  onClick,
  onCategorize,
  onCategoryCreated,
}: {
  tx: Transaction
  categories: Category[]
  showDate: boolean
  selectMode: boolean
  selected: boolean
  onClick: () => void
  onCategorize: (categoryId: string | null, created?: Category) => void
  onCategoryCreated: (category: Category) => void
}) {
  const pending = tx.plaid_details?.pending
  const meta = [
    showDate ? parseLocalDate(tx.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null,
    accountLabel(tx),
    locationLabel(tx.plaid_details),
  ].filter(Boolean).join(" · ")

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted",
        selected && "border-primary bg-primary/5",
        tx.hidden && "opacity-60"
      )}
      onClick={onClick}
    >
      {selectMode && (
        <Checkbox checked={selected} className="mt-2.5 flex-shrink-0 pointer-events-none" aria-label="Select transaction" />
      )}

      <TransactionAvatar transaction={tx} categories={categories} />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="font-medium text-[15px] truncate"
            title={tx.description !== displayName(tx) ? tx.description : undefined}
          >
            {displayName(tx)}
          </span>
          <PrivateAmount
            amount={tx.amount}
            type={tx.transaction_type}
            className={cn(
              "text-[15px] font-semibold flex-shrink-0 tabular-nums",
              tx.transaction_type === "credit" ? "text-green-600" : "text-foreground",
              pending && "text-muted-foreground"
            )}
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
          {pending && (
            <span className="flex-shrink-0 rounded px-1 py-px text-[10px] font-semibold uppercase tracking-wide bg-amber-500/15 text-amber-700 dark:text-amber-400">
              Pending
            </span>
          )}
          {tx.recurring && <Repeat className="h-3 w-3 flex-shrink-0" aria-label="Recurring" />}
          {tx.hidden && <EyeOff className="h-3 w-3 flex-shrink-0" aria-label="Hidden" />}
          <span className="truncate">{meta}</span>
        </div>

        {!selectMode && (
          <div className="mt-1.5">
            <CategoryPicker
              categories={categories}
              value={tx.category_id}
              suggestionFor={{ transactionId: tx.id, description: tx.description, amount: tx.amount }}
              onSelect={onCategorize}
              onCategoryCreated={onCategoryCreated}
            />
          </div>
        )}
      </div>
    </div>
  )
}
