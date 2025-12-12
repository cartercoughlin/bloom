"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Filter, X, Upload } from "lucide-react"
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

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Debug: Log transaction ID
      if (!tx.id) {
        console.error('Transaction missing ID:', tx)
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
  }, [transactions, searchTerm, categoryFilter, typeFilter, dateFrom, dateTo, amountMin, amountMax])

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
  }

  const hasActiveFilters = searchTerm || categoryFilter !== "all" || typeFilter !== "all" || 
                          dateFrom || dateTo || amountMin || amountMax

  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Upload className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No transactions yet</h3>
          <p className="text-muted-foreground text-center mb-6">Import your first transactions to get started</p>
          <Link href="/transactions/import">
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Import Transactions
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>
              {filteredTransactions.length} of {transactions.length} transactions
            </CardDescription>
          </div>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
          )}
        </div>
        
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <Input
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
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
            <SelectTrigger>
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
            />
            <Input
              placeholder="Max amount"
              type="number"
              value={amountMax}
              onChange={(e) => setAmountMax(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="mr-2 h-4 w-4" />
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
              <Button variant="outline" size="sm">
                <CalendarIcon className="mr-2 h-4 w-4" />
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
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b">
              <tr>
                <th className="text-left p-3 text-sm font-medium">Date</th>
                <th className="text-left p-3 text-sm font-medium">Description</th>
                <th className="text-left p-3 text-sm font-medium">Category</th>
                <th className="text-left p-3 text-sm font-medium">Bank</th>
                <th className="text-right p-3 text-sm font-medium">Amount</th>
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
                  <td className="p-3 text-sm">
                    {new Date(tx.date).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-sm max-w-xs truncate" title={tx.description}>
                    {tx.description}
                  </td>
                  <td className="p-3 text-sm min-w-48">
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
                      <span className="text-muted-foreground text-xs">
                        No ID found
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-sm capitalize">{tx.bank}</td>
                  <td
                    className={`p-3 text-sm text-right font-medium ${
                      tx.transaction_type === "credit" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {tx.transaction_type === "credit" ? "+" : "-"}${tx.amount.toFixed(2)}
                  </td>
                </tr>
              )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
