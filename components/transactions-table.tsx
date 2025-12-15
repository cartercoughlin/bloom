"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Filter, X, Upload, EyeOff, Eye, Repeat } from "lucide-react"
import { format } from "date-fns"
import { TransactionCategorizer } from "./transaction-categorizer"
import Link from "next/link"

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  transaction_type: "credit" | "debit"
  bank: string
  category_id?: string
  hidden?: boolean
  recurring?: boolean
  merchant_name?: string | null
  logo_url?: string | null
  website?: string | null
  category_detailed?: string | null
  categories?: {
    name: string
    color: string
    icon?: string
  }
}

interface Category {
  id: string
  name: string
  color: string
  icon?: string
}

interface TransactionsTableProps {
  transactions: Transaction[]
  categories: Category[]
}

export function TransactionsTable({ transactions: initialTransactions, categories: initialCategories }: TransactionsTableProps) {
  // Debug: Log initial transactions on mount
  console.log('TransactionsTable - Initial transactions:', initialTransactions)
  console.log('TransactionsTable - First transaction ID:', initialTransactions?.[0]?.id)
  console.log('TransactionsTable - First transaction ID type:', typeof initialTransactions?.[0]?.id)

  const [transactions, setTransactions] = useState(initialTransactions)
  const [categories, setCategories] = useState(initialCategories)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<Date>()
  const [dateTo, setDateTo] = useState<Date>()
  const [amountMin, setAmountMin] = useState("")
  const [amountMax, setAmountMax] = useState("")
  const [showHidden, setShowHidden] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Debug: Log transaction ID
      if (!tx.id) {
        console.error('Transaction missing ID:', tx)
      }

      // Hidden filter - skip hidden transactions unless showHidden is true
      if (tx.hidden && !showHidden) {
        return false
      }

      // Search filter
      if (searchTerm && !tx.description.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !tx.bank.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }

      // Category filter
      if (categoryFilter !== "all") {
        if (categoryFilter === "uncategorized" && tx.category_id) return false
        if (categoryFilter !== "uncategorized" && tx.category_id !== categoryFilter) return false
      }

      // Type filter
      if (typeFilter !== "all" && tx.transaction_type !== typeFilter) return false

      // Date filters
      const txDate = new Date(tx.date)
      if (dateFrom && txDate < dateFrom) return false
      if (dateTo && txDate > dateTo) return false

      // Amount filters
      if (amountMin && tx.amount < parseFloat(amountMin)) return false
      if (amountMax && tx.amount > parseFloat(amountMax)) return false

      return true
    })
  }, [transactions, searchTerm, categoryFilter, typeFilter, dateFrom, dateTo, amountMin, amountMax, showHidden])

  const handleToggleHidden = async (transactionId: string, currentHidden: boolean) => {
    try {
      const response = await fetch(`/api/transactions/${transactionId}/hidden`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: !currentHidden }),
      })

      if (response.ok) {
        setTransactions(prev =>
          prev.map(tx =>
            tx.id === transactionId ? { ...tx, hidden: !currentHidden } : tx
          )
        )
      } else {
        console.error("Failed to toggle hidden status")
        alert("Failed to update transaction visibility")
      }
    } catch (error) {
      console.error("Error toggling hidden status:", error)
      alert("Error updating transaction visibility")
    }
  }

  const handleToggleRecurring = async (transactionId: string, currentRecurring: boolean) => {
    try {
      const response = await fetch(`/api/transactions/${transactionId}/recurring`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recurring: !currentRecurring }),
      })

      if (response.ok) {
        setTransactions(prev =>
          prev.map(tx =>
            tx.id === transactionId ? { ...tx, recurring: !currentRecurring } : tx
          )
        )
      } else {
        console.error("Failed to toggle recurring status")
        alert("Failed to update recurring status")
      }
    } catch (error) {
      console.error("Error toggling recurring status:", error)
      alert("Error updating recurring status")
    }
  }

  const handleCategoryChange = (transactionId: string, categoryId: string, newCategory?: Category) => {
    // Add new category to list if provided
    if (newCategory) {
      setCategories(prev => [...prev, newCategory])
    }
    
    setTransactions(prev => 
      prev.map(tx => 
        tx.id === transactionId 
          ? { 
              ...tx, 
              category_id: categoryId || undefined,
              categories: categoryId ? (newCategory || categories.find(c => c.id === categoryId)) : undefined
            }
          : tx
      )
    )
  }

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

  return (
    <div className="sm:bg-card sm:border sm:rounded-lg">
      <div className="p-4 sm:p-6 border-b sm:border-b-border border-b-transparent">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base md:text-lg font-semibold">Transactions</h2>
            <p className="text-xs md:text-sm text-muted-foreground">
              {filteredTransactions.length} of {transactions.length} transactions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowFilters(!showFilters)}
              className="text-xs md:text-sm h-7 md:h-9 px-2 md:px-3"
            >
              <Filter className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Filters</span>
            </Button>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="text-xs md:text-sm h-7 md:h-9 px-2 md:px-3">
                <X className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Clear</span>
              </Button>
            )}
          </div>
        </div>

        {/* Collapsible Filters */}
        {showFilters && (
          <div className="space-y-3 mt-4 p-4 bg-green-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
          <Input
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-xs md:text-sm h-8 md:h-10"
          />

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
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
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
              value={amountMin}
              onChange={(e) => setAmountMin(e.target.value)}
              className="text-xs md:text-sm h-8 md:h-10"
            />
            <Input
              placeholder="Max amount"
              type="number"
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
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={setDateFrom}
                initialFocus
              />
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
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={setDateTo}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Button
            variant={showHidden ? "default" : "outline"}
            size="sm"
            onClick={() => setShowHidden(!showHidden)}
            className="text-xs md:text-sm h-7 md:h-9 px-2 md:px-3"
          >
            {showHidden ? <Eye className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" /> : <EyeOff className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />}
            {showHidden ? "Hiding hidden" : "Show hidden"}
          </Button>
          </div>
          </div>
        )}
      </div>

      <div className="sm:p-6 p-0">
        <div className="overflow-x-auto -mx-3 sm:mx-0">
          <table className="w-full min-w-full">
            <thead className="border-b">
              <tr>
                <th className="text-left p-2 md:p-3 text-[10px] md:text-sm font-medium w-16 md:w-auto">Date</th>
                <th className="text-left p-2 md:p-3 text-[10px] md:text-sm font-medium">Description</th>
                <th className="text-left p-2 md:p-3 text-[10px] md:text-sm font-medium w-16 md:w-48">Category</th>
                <th className="text-left p-2 md:p-3 text-[10px] md:text-sm font-medium hidden sm:table-cell">Bank</th>
                <th className="text-right p-2 md:p-3 text-[10px] md:text-sm font-medium w-20 md:w-auto">Amount</th>
                <th className="text-right p-2 md:p-3 text-[10px] md:text-sm font-medium w-16 md:w-auto">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredTransactions.map((tx, index) => {
                console.log('Full transaction object:', tx)
                console.log('Transaction keys:', Object.keys(tx))

                // Capture the ID in a variable to avoid closure issues
                const txId = tx.id
                console.log('Captured transaction ID:', txId)

                return (
                <tr key={txId} className="hover:bg-muted/50">
                  <td className="p-1 md:p-3 text-[9px] md:text-sm whitespace-nowrap">
                    <div className="md:hidden">{new Date(tx.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</div>
                    <div className="hidden md:block">{new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                  </td>
                  <td className="p-1 md:p-3 text-[9px] md:text-sm">
                    <div className="flex items-center gap-1 md:gap-2">
                      {tx.logo_url && (
                        <img 
                          src={tx.logo_url} 
                          alt={tx.merchant_name || tx.description}
                          className="w-4 h-4 md:w-8 md:h-8 rounded-full object-cover flex-shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="truncate text-[9px] md:text-sm">{tx.merchant_name || tx.description}</span>
                          {tx.recurring && (
                            <Badge variant="outline" className="text-[7px] md:text-[10px] px-0.5 py-0 h-3 md:h-5 flex-shrink-0">
                              <Repeat className="h-2 w-2 md:h-3 md:w-3" />
                            </Badge>
                          )}
                        </div>
                        {tx.category_detailed && (
                          <div className="text-[7px] md:text-xs text-muted-foreground truncate">
                            {tx.category_detailed}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-1 md:p-3 text-[9px] md:text-sm w-16 md:w-48">
                    {txId ? (
                      <TransactionCategorizer
                        transactionId={txId}
                        description={tx.description}
                        amount={tx.amount}
                        currentCategoryId={tx.category_id}
                        categories={categories}
                        onCategoryChange={(categoryId, newCategory) => {
                          console.log('Callback - Transaction ID:', txId)
                          console.log('Callback - Category ID:', categoryId)
                          handleCategoryChange(txId, categoryId, newCategory)
                        }}
                      />
                    ) : (
                      <span className="text-muted-foreground text-[8px] md:text-xs">
                        No ID
                      </span>
                    )}
                  </td>
                  <td className="p-1 md:p-3 text-[9px] md:text-sm capitalize hidden sm:table-cell">{tx.bank}</td>
                  <td
                    className={`p-1 md:p-3 text-[9px] md:text-sm text-right font-medium whitespace-nowrap ${
                      tx.transaction_type === "credit" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    <div className="md:hidden">{tx.transaction_type === "credit" ? "+" : "-"}${Math.round(tx.amount)}</div>
                    <div className="hidden md:block">{tx.transaction_type === "credit" ? "+" : "-"}${tx.amount.toFixed(2)}</div>
                  </td>
                  <td className="p-1 md:p-3 text-[9px] md:text-sm text-right">
                    <div className="flex items-center gap-0.5 md:gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleRecurring(txId, tx.recurring || false)}
                        className={`h-5 md:h-7 px-0.5 md:px-2 ${tx.recurring ? 'text-blue-600' : ''}`}
                        title={tx.recurring ? "Mark as non-recurring" : "Mark as recurring"}
                      >
                        <Repeat className="h-2.5 w-2.5 md:h-4 md:w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleHidden(txId, tx.hidden || false)}
                        className="h-5 md:h-7 px-0.5 md:px-2"
                        title={tx.hidden ? "Show transaction" : "Hide transaction"}
                      >
                        {tx.hidden ? <Eye className="h-2.5 w-2.5 md:h-4 md:w-4" /> : <EyeOff className="h-2.5 w-2.5 md:h-4 md:w-4" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
