"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { CalendarIcon, Filter, X, Upload, EyeOff, Eye, Repeat, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { TransactionCategorizer } from "./transaction-categorizer"
import Link from "next/link"
import { PrivateAmount } from "./private-amount"

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
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [categoryJustChanged, setCategoryJustChanged] = useState<string | null>(null)

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
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

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {}
    
    filteredTransactions.forEach(tx => {
      const dateKey = tx.date
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(tx)
    })
    
    // Sort dates descending and sort transactions within each date
    return Object.keys(groups)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map(date => ({
        date,
        transactions: groups[date].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }))
  }, [filteredTransactions])

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

  const handleDeleteTransaction = async (transactionId: string) => {
    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        // Remove transaction from the list
        setTransactions(prev => prev.filter(tx => tx.id !== transactionId))
        // Close the modal
        setSelectedTransaction(null)
      } else {
        console.error("Failed to delete transaction")
        alert("Failed to delete transaction")
      }
    } catch (error) {
      console.error("Error deleting transaction:", error)
      alert("Error deleting transaction")
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

    // Prevent modal from opening for a short time after category change
    setCategoryJustChanged(transactionId)
    setTimeout(() => setCategoryJustChanged(null), 300)
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
      <div className="p-2 sm:p-4 border-b sm:border-b-border border-b-transparent">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {filteredTransactions.length} of {transactions.length}
          </p>
          <div className="flex items-center gap-1">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowFilters(!showFilters)}
              className="text-xs h-7 px-2"
            >
              <Filter className="mr-1 h-3 w-3" />
              <span className="hidden sm:inline">Filters</span>
            </Button>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="text-xs h-7 px-2">
                <X className="mr-1 h-3 w-3" />
                <span className="hidden sm:inline">Clear</span>
              </Button>
            )}
          </div>
        </div>

        {/* Collapsible Filters */}
        {showFilters && (
          <div className="space-y-3 mt-4 p-4 bg-muted rounded-lg border">
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

      <div className="sm:p-4 p-0">
        <div className="w-full space-y-4">
          {groupedTransactions.map(({ date, transactions: dayTransactions }) => (
            <div key={date}>
              {/* Date Divider */}
              <div className="flex items-center gap-3 mb-3">
                <div className="text-sm md:text-base font-medium text-muted-foreground">
                  {new Date(date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
                <div className="flex-1 h-px bg-border"></div>
              </div>
              
              {/* Transactions for this date */}
              <div className="space-y-2">
                {dayTransactions.map((tx) => {
                  const txId = tx.id

                  return (
                    <div
                      key={txId}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                      onClick={() => {
                        if (categoryJustChanged !== txId) {
                          setSelectedTransaction(tx)
                        }
                      }}
                    >
                      {/* Logo - Desktop only */}
                      {tx.logo_url && (
                        <img 
                          src={tx.logo_url} 
                          alt={tx.merchant_name || tx.description}
                          className="hidden md:block w-8 h-8 rounded-full object-cover flex-shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      )}
                      
                      {/* Transaction Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span
                              className="font-medium text-sm md:text-base truncate"
                              title={tx.merchant_name && tx.description !== tx.merchant_name ? tx.description : undefined}
                            >
                              {tx.merchant_name || tx.description}
                            </span>
                            {tx.recurring && (
                              <Badge variant="outline" className="text-xs px-1 py-0 h-5 flex-shrink-0">
                                <Repeat className="h-3 w-3" />
                              </Badge>
                            )}
                          </div>
                          <PrivateAmount
                            amount={tx.amount}
                            type={tx.transaction_type}
                            className={`text-sm md:text-base font-semibold flex-shrink-0 ${
                              tx.transaction_type === "credit" ? "text-green-600" : "text-red-600"
                            }`}
                          />
                        </div>
                        
                        {/* Category */}
                        <div className="mt-2">
                          {txId ? (
                            <TransactionCategorizer
                              transactionId={txId}
                              description={tx.description}
                              amount={tx.amount}
                              currentCategoryId={tx.category_id}
                              categories={categories}
                              onCategoryChange={(categoryId, newCategory) => {
                                handleCategoryChange(txId, categoryId, newCategory)
                              }}
                            />
                          ) : (
                            <span className="text-muted-foreground text-xs">No ID</span>
                          )}
                        </div>
                        
                        {tx.category_detailed && (
                          <div className="text-xs text-muted-foreground truncate mt-1">
                            {tx.category_detailed}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          
          {groupedTransactions.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No transactions found</p>
            </div>
          )}
        </div>
      </div>

      {/* Transaction Detail Modal */}
      <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {selectedTransaction.logo_url && (
                  <img 
                    src={selectedTransaction.logo_url} 
                    alt={selectedTransaction.merchant_name || selectedTransaction.description}
                    className="w-8 h-8 rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-medium">{selectedTransaction.merchant_name || selectedTransaction.description}</h3>
                  {selectedTransaction.merchant_name && selectedTransaction.description !== selectedTransaction.merchant_name && (
                    <p className="text-sm text-muted-foreground">{selectedTransaction.description}</p>
                  )}
                  <p className="text-sm text-muted-foreground">{selectedTransaction.bank}</p>
                </div>
                <PrivateAmount
                  amount={selectedTransaction.amount}
                  type={selectedTransaction.transaction_type}
                  className={`text-lg font-semibold ${
                    selectedTransaction.transaction_type === "credit" ? "text-green-600" : "text-red-600"
                  }`}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Category</label>
                <div className="mt-1">
                  <TransactionCategorizer
                    transactionId={selectedTransaction.id}
                    description={selectedTransaction.description}
                    amount={selectedTransaction.amount}
                    currentCategoryId={selectedTransaction.category_id}
                    categories={categories}
                    onCategoryChange={(categoryId, newCategory) => {
                      handleCategoryChange(selectedTransaction.id, categoryId, newCategory)
                      // Update the selected transaction to reflect the change
                      setSelectedTransaction(prev => prev ? {
                        ...prev,
                        category_id: categoryId || undefined,
                        categories: categoryId ? (newCategory || categories.find(c => c.id === categoryId)) : undefined
                      } : null)
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant={selectedTransaction.recurring ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    handleToggleRecurring(selectedTransaction.id, selectedTransaction.recurring || false)
                    setSelectedTransaction(prev => prev ? { ...prev, recurring: !prev.recurring } : null)
                  }}
                  className="flex-1"
                >
                  <Repeat className="mr-2 h-4 w-4" />
                  {selectedTransaction.recurring ? "Recurring" : "Mark Recurring"}
                </Button>
                <Button
                  variant={selectedTransaction.hidden ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    handleToggleHidden(selectedTransaction.id, selectedTransaction.hidden || false)
                    setSelectedTransaction(prev => prev ? { ...prev, hidden: !prev.hidden } : null)
                  }}
                  className="flex-1"
                >
                  {selectedTransaction.hidden ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                  {selectedTransaction.hidden ? "Show" : "Hide"}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this transaction? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteTransaction(selectedTransaction.id)}
                        className="bg-destructive text-white hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
