"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { cache } from "@/lib/capacitor"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Plus, Edit, Trash2, Loader2, Target, Repeat } from "lucide-react"
import { useRouter } from "next/navigation"
import { PrivateAmount } from "./private-amount"
import { CategoryForm } from "./category-form"
import { HistoricalRecurringData } from "@/lib/budget/historical-recurring"

interface Budget {
  id: string
  amount: number
  category_id: string
  enable_rollover?: boolean
  categories: {
    id: string
    name: string
    color: string
    icon: string | null
  } | null
}

interface Category {
  id: string
  name: string
  color: string
  icon: string | null
  is_rollover?: boolean
  target_amount?: number | null
}

interface BudgetListProps {
  budgets: Budget[]
  categories: Category[]
  netByCategory: Record<string, {
    income: number
    expenses: number
    net: number
    recurringExpenses: number
    variableExpenses: number
  }>
  spending: Record<string, number>
  rolloverByCategory?: Record<string, number>
  historicalRecurring?: HistoricalRecurringData
  month: number
  year: number
  editBudgetId?: string | null
  onEditComplete?: () => void
  onRefresh?: () => void
  allBudgets?: Budget[]
}

export function BudgetList({
  budgets: initialBudgets,
  categories: initialCategories,
  netByCategory,
  spending,
  rolloverByCategory = {},
  historicalRecurring,
  month,
  year,
  editBudgetId = null,
  onEditComplete,
  onRefresh,
  allBudgets
}: BudgetListProps) {
  const [budgets, setBudgets] = useState(initialBudgets)
  const [categories, setCategories] = useState(initialCategories)
  const [isOpen, setIsOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState("")
  const [amount, setAmount] = useState("")
  const [enableRollover, setEnableRollover] = useState(true)
  const [isSavingsGoal, setIsSavingsGoal] = useState(false)
  const [targetAmount, setTargetAmount] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showTransactions, setShowTransactions] = useState(false)
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null)
  const [categoryTransactions, setCategoryTransactions] = useState<any[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null)
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
  const router = useRouter()

  // Sync internal state with props when they change
  useEffect(() => {
    setBudgets(initialBudgets)
  }, [initialBudgets])

  useEffect(() => {
    setCategories(initialCategories)
  }, [initialCategories])

  // Update savings goal state when selected category changes
  useEffect(() => {
    if (selectedCategoryId) {
      const category = categories.find(c => c.id === selectedCategoryId)
      if (category) {
        setIsSavingsGoal(category.is_rollover || false)
        setTargetAmount(category.target_amount?.toString() || "")
      }
    }
  }, [selectedCategoryId, categories])

  // Handle savings goal toggle
  const handleSavingsGoalToggle = (checked: boolean) => {
    setIsSavingsGoal(checked)
    // Auto-fill target amount with budget amount when toggled ON
    if (checked && !targetAmount && amount) {
      setTargetAmount(amount)
    }
  }

  // Handle external edit request (from savings goals)
  useEffect(() => {
    if (editBudgetId) {
      const searchBudgets = allBudgets || budgets
      const budgetToEdit = searchBudgets.find(b => b.id === editBudgetId)
      if (budgetToEdit) {
        handleOpenDialog(budgetToEdit)
      }
    }
  }, [editBudgetId, allBudgets, budgets])

  // Calculate percentage through the month
  const getPercentageThroughMonth = () => {
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Only show expected marker if viewing current month
    if (month !== currentMonth || year !== currentYear) {
      return null
    }

    const currentDay = now.getDate()
    const daysInMonth = new Date(year, month, 0).getDate()
    return (currentDay / daysInMonth) * 100
  }

  const percentageThroughMonth = getPercentageThroughMonth()

  const fetchLatestCategories = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", user.id)
      .order("name")
    if (data) {
      setCategories(data)
    }
  }

  const handleOpenDialog = async (budget?: Budget) => {
    // Fetch latest categories to include any newly created ones
    await fetchLatestCategories()

    if (budget) {
      const isVirtual = budget.id?.startsWith('virtual-')
      setEditingBudget(isVirtual ? null : budget)
      setSelectedCategoryId(budget.category_id)
      setAmount(budget.amount.toString())
      setEnableRollover(budget.enable_rollover !== false) // Default to true

      // Set savings goal state from category
      const category = categories.find(c => c.id === budget.category_id)
      setIsSavingsGoal(category?.is_rollover || false)
      setTargetAmount(category?.target_amount?.toString() || "")
    } else {
      setEditingBudget(null)
      setSelectedCategoryId("")
      setAmount("")
      setEnableRollover(true) // Default to true for new budgets
      setIsSavingsGoal(false)
      setTargetAmount("")
    }
    setIsOpen(true)
  }

  const handleSave = async () => {
    if (!selectedCategoryId || !amount) return

    setIsLoading(true)
    const supabase = createClient()

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      if (editingBudget) {
        // Update existing budget
        const { error } = await supabase
          .from("budgets")
          .update({
            amount: Number.parseFloat(amount),
            enable_rollover: enableRollover
          })
          .eq("id", editingBudget.id)
          .eq("user_id", user.id)

        if (error) throw error
      } else {
        // Create new budget
        const { error } = await supabase.from("budgets").insert({
          user_id: user.id,
          category_id: selectedCategoryId,
          amount: Number.parseFloat(amount),
          enable_rollover: enableRollover,
          month,
          year,
        })

        if (error) throw error
      }

      // Update category savings goal settings if changed
      const category = categories.find(c => c.id === selectedCategoryId)
      if (category && (category.is_rollover !== isSavingsGoal || category.target_amount?.toString() !== targetAmount)) {
        const { error: categoryError } = await supabase
          .from("categories")
          .update({
            is_rollover: isSavingsGoal,
            target_amount: isSavingsGoal && targetAmount ? parseFloat(targetAmount) : null,
          })
          .eq("id", selectedCategoryId)
          .eq("user_id", user.id)

        if (categoryError) throw categoryError

        // Update local categories state
        setCategories(prev => prev.map(c =>
          c.id === selectedCategoryId
            ? { ...c, is_rollover: isSavingsGoal, target_amount: isSavingsGoal && targetAmount ? parseFloat(targetAmount) : null }
            : c
        ))
      }

      // Invalidate cache to force fresh data load
      await cache.removePattern(`budgets-${year}-${month}`)
      await cache.removePattern(`dashboard-${year}-${month}`)

      setIsOpen(false)
      if (onEditComplete) onEditComplete()
      if (onRefresh) onRefresh()
    } catch (error) {
      console.error("Error saving budget:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (budgetId: string) => {
    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { error } = await supabase
        .from("budgets")
        .delete()
        .eq("id", budgetId)
        .eq("user_id", user.id)

      if (error) throw error

      // Invalidate cache to force fresh data load
      await cache.removePattern(`budgets-${year}-${month}`)
      await cache.removePattern(`dashboard-${year}-${month}`)

      setBudgets(budgets.filter((b) => b.id !== budgetId))
      if (onRefresh) onRefresh()
    } catch (error) {
      console.error("Error deleting budget:", error)
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
        setCategoryTransactions(prev =>
          prev.map(tx =>
            tx.id === transactionId ? { ...tx, recurring: !currentRecurring } : tx
          )
        )
        if (selectedTransaction?.id === transactionId) {
          setSelectedTransaction({ ...selectedTransaction, recurring: !currentRecurring })
        }
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
        // Invalidate cache to force fresh data load
        await cache.removePattern(`budgets-${year}-${month}`)
        await cache.removePattern(`dashboard-${year}-${month}`)

        setCategoryTransactions(prev => prev.filter(tx => tx.id !== transactionId))
        setSelectedTransaction(null)
        if (onRefresh) onRefresh()
      } else {
        console.error("Failed to delete transaction")
        alert("Failed to delete transaction")
      }
    } catch (error) {
      console.error("Error deleting transaction:", error)
      alert("Error deleting transaction")
    }
  }

  const handleShowTransactions = async (budget: Budget) => {
    setSelectedBudget(budget)
    setShowTransactions(true)
    setLoadingTransactions(true)

    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Get transactions for this category and month (use local dates to avoid timezone issues)
      const lastDayDate = new Date(year, month, 0)
      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
      const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`

      // Calculate next month for strict filtering
      const nextMonth = month === 12 ? 1 : month + 1
      const nextYear = month === 12 ? year + 1 : year
      const nextMonthFirstDay = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

      console.log(`[Budget Modal] Loading transactions for category ${budget.categories?.name}:`, {
        year,
        month,
        firstDay,
        lastDay,
        nextMonthFirstDay,
        lastDayDate: lastDayDate.toISOString(),
        lastDayGetDate: lastDayDate.getDate()
      })

      const { data, error } = await supabase
        .from("transactions")
        .select("id, date, description, amount, transaction_type, merchant_name, logo_url, hidden, recurring")
        .eq("user_id", user.id)
        .eq("category_id", budget.category_id)
        .gte("date", firstDay)
        .lt("date", nextMonthFirstDay)  // Strict: less than first day of NEXT month
        .or("deleted.is.null,deleted.eq.false")
        .order("date", { ascending: false })

      console.log(`[Budget Modal] Received ${data?.length || 0} transactions:`,
        data?.slice(0, 10).map(tx => ({ date: tx.date, desc: tx.description, amount: tx.amount }))
      )

      if (error) throw error

      setCategoryTransactions(data || [])
    } catch (error) {
      console.error("Error loading transactions:", error)
      setCategoryTransactions([])
    } finally {
      setLoadingTransactions(false)
    }
  }

  const usedCategoryIds = budgets.map((b) => b.category_id)
  const availableCategories = categories.filter((c) => !usedCategoryIds.includes(c.id) || c.id === selectedCategoryId)

  const handleDialogClose = (open: boolean) => {
    setIsOpen(open)
    if (!open && onEditComplete) {
      onEditComplete()
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg md:text-2xl font-bold">Category Budgets</h2>
          <p className="text-muted-foreground text-xs md:text-sm">Set spending limits for each category</p>
        </div>
        <Dialog open={isOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="text-xs md:text-sm h-8 md:h-10 px-3 md:px-4">
              <Plus className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Add Budget</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingBudget ? "Edit Budget" : "Add Budget"}</DialogTitle>
              <DialogDescription>Set a monthly spending limit for a category</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="category">Category</Label>
                  {!editingBudget && (
                    <Button
                      variant="link"
                      className="h-auto p-0 text-xs text-blue-600"
                      onClick={() => setIsCategoryDialogOpen(true)}
                    >
                      + New Category
                    </Button>
                  )}
                </div>
                <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId} disabled={!!editingBudget}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.icon} {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sub-dialog for category creation */}
              <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New Category</DialogTitle>
                    <DialogDescription>Add a new category to use in your budget</DialogDescription>
                  </DialogHeader>
                  <CategoryForm
                    onSuccess={() => {
                      setIsCategoryDialogOpen(false)
                      fetchLatestCategories() // Fetch fresh categories after creation
                    }}
                    onCancel={() => setIsCategoryDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
              <div className="space-y-2">
                <Label htmlFor="amount">Monthly Budget Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="enable-rollover">Enable Rollover</Label>
                  <p className="text-xs text-muted-foreground">
                    Allow unused/overspent amounts to carry over to next month
                  </p>
                </div>
                <Switch
                  id="enable-rollover"
                  checked={enableRollover}
                  onCheckedChange={setEnableRollover}
                />
              </div>

              {selectedCategoryId && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="savings-goal">Savings Goal / Rollover Category</Label>
                      <p className="text-xs text-muted-foreground">
                        Unused budget carries over to next month
                      </p>
                    </div>
                    <Switch
                      id="savings-goal"
                      checked={isSavingsGoal}
                      onCheckedChange={handleSavingsGoalToggle}
                    />
                  </div>

                  {isSavingsGoal && (
                    <div className="space-y-2 pt-2 border-t">
                      <Label htmlFor="target-amount">Target Amount (Optional)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                        <Input
                          id="target-amount"
                          type="number"
                          step="0.01"
                          value={targetAmount}
                          onChange={(e) => setTargetAmount(e.target.value)}
                          className="pl-7"
                          placeholder="e.g., 2000"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Set a savings goal target for this category
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isLoading || !selectedCategoryId || !amount}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Budget"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {budgets.length > 0 ? (
        <div className="grid gap-3 md:gap-4">
          {budgets.map((budget) => {
            const categoryData = netByCategory[budget.category_id] || {
              income: 0,
              expenses: 0,
              net: 0,
              recurringExpenses: 0,
              variableExpenses: 0,
            }
            const expenses = categoryData.expenses
            const income = categoryData.income
            const net = categoryData.net
            const recurringExpenses = categoryData.recurringExpenses
            const variableExpenses = categoryData.variableExpenses

            // Get rollover for this category
            const rollover = rolloverByCategory[budget.category_id] || 0

            // Budget amount including rollover
            const baseBudget = Number(budget.amount)
            const totalBudget = baseBudget + rollover

            // For income categories (income > expenses), net is negative, so don't show budget usage
            // For expense categories, show net spending (expenses - income) against budget
            const netSpending = Math.max(0, expenses - income) // Don't go negative
            const percentage = (netSpending / totalBudget) * 100
            const isOverBudget = netSpending > totalBudget
            const isIncomeCategory = income > expenses

            // Calculate expected spending using historical recurring data when available
            // Historical data tells us what recurring expenses to expect for the full month
            // Rollover is available immediately, not scaled through the month
            const calculateExpectedSpending = () => {
              if (percentageThroughMonth === null) return 0

              // If we have historical data for this category, use hybrid approach
              const historicalRecurringForCategory = historicalRecurring?.byCategory?.[budget.category_id] || 0
              const hasHistoricalData = historicalRecurring && historicalRecurring.monthsUsed > 0 && historicalRecurringForCategory > 0

              if (hasHistoricalData) {
                // Use baseBudget (not totalBudget) so rollover isn't scaled
                const historicalVariableFromBase = Math.max(0, baseBudget - historicalRecurringForCategory)

                // Net recurring expenses (after income offsets)
                const netRecurringExpenses = Math.max(0, recurringExpenses - income)

                // Expected recurring: whichever is higher - what's already hit or baseline expectation
                const expectedRecurringBaseline = historicalRecurringForCategory * (percentageThroughMonth / 100)
                const expectedRecurring = Math.max(netRecurringExpenses, expectedRecurringBaseline)

                // Expected variable: scales linearly through the month (from base budget only)
                const expectedVariable = historicalVariableFromBase * (percentageThroughMonth / 100)

                // Rollover is available immediately from day 1, so add the full amount
                return expectedRecurring + expectedVariable + rollover
              }

              // Fallback: no historical data for this category
              // Use actual recurring spent so far as the baseline, scale base budget variable only
              // Rollover is available immediately from day 1, so add the full amount
              const netRecurringExpenses = Math.max(0, recurringExpenses - income)
              const remainingBaseBudget = Math.max(0, baseBudget - netRecurringExpenses)

              return netRecurringExpenses + (remainingBaseBudget * (percentageThroughMonth / 100)) + rollover
            }

            const expectedSpending = calculateExpectedSpending()
            const pacingDifference = percentageThroughMonth !== null ? netSpending - expectedSpending : 0

            return (
              <Card
                key={budget.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleShowTransactions(budget)}
              >
                <CardHeader className="pb-3 md:pb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 md:gap-3">
                      {budget.categories && (
                        <div
                          className="w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center text-base md:text-xl"
                          style={{ backgroundColor: `${budget.categories.color}20` }}
                        >
                          {budget.categories.icon}
                        </div>
                      )}
                      <div className="flex-1">
                        <CardTitle className="text-sm md:text-lg">{budget.categories?.name}</CardTitle>
                        <CardDescription className="text-xs md:text-sm">
                          {isIncomeCategory ? (
                            <>
                              Income: <PrivateAmount amount={income} className="inline" />
                              {expenses > 0 && <span className="text-muted-foreground ml-2">• Expenses: <PrivateAmount amount={expenses} className="inline" /></span>}
                            </>
                          ) : (
                            <>
                              Net Spending: <PrivateAmount amount={netSpending} className="inline" /> of <PrivateAmount amount={totalBudget} className="inline" />
                              {rollover > 0 && (
                                <span className="text-green-600 ml-2">
                                  • <PrivateAmount amount={rollover} prefix="$" className="inline" /> rollover
                                </span>
                              )}
                            </>
                          )}
                        </CardDescription>
                        {!isIncomeCategory && percentageThroughMonth !== null && pacingDifference !== 0 && (
                          <p className={`text-xs mt-1 ${pacingDifference <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            <PrivateAmount amount={Math.abs(pacingDifference)} prefix="$" className="inline" /> {pacingDifference <= 0 ? 'ahead' : 'behind'} pace
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 md:gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenDialog(budget)
                        }}
                        className="h-7 w-7 md:h-9 md:w-9"
                      >
                        <Edit className="h-3 w-3 md:h-4 md:w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => e.stopPropagation()}
                            className="h-7 w-7 md:h-9 md:w-9"
                          >
                            <Trash2 className="h-3 w-3 md:h-4 md:w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Budget?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete the budget for {budget.categories?.name}? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(budget.id)}
                              className="bg-destructive text-white hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <div className="relative">
                    <Progress
                      value={Math.min(percentage, 100)}
                      className={`h-1.5 md:h-2 ${isOverBudget ? "bg-red-100" : undefined}`}
                      indicatorClassName={isOverBudget ? "bg-red-600" : "bg-green-600"}
                    />
                    {percentageThroughMonth !== null && !isIncomeCategory && (
                      <div
                        className="absolute -top-1 -bottom-1 w-1 bg-blue-600 dark:bg-blue-400 z-10 shadow-lg"
                        style={{ left: `${Math.min((expectedSpending / totalBudget) * 100, 100)}%` }}
                        title={`Expected: $${expectedSpending.toFixed(2)} (${recurringExpenses > 0 ? `$${recurringExpenses.toFixed(2)} recurring + ` : ''}$${(variableExpenses * (percentageThroughMonth / 100)).toFixed(2)} variable)`}
                      />
                    )}
                  </div>
                  <div className="flex justify-between text-xs md:text-sm">
                    <span className={isOverBudget ? "text-red-600 font-medium" : "text-muted-foreground"}>
                      {isIncomeCategory ? "Income category" : `${percentage.toFixed(1)}% used`}
                    </span>
                    <span className={isOverBudget ? "text-red-600 font-medium" : "text-green-600"}>
                      {isIncomeCategory
                        ? (<>Net: <PrivateAmount amount={Math.abs(net)} prefix="+$" className="inline" /></>)
                        : (<><PrivateAmount amount={Math.abs(totalBudget - netSpending)} className="inline" /> {isOverBudget ? "over budget" : "remaining"}</>)
                      }
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 md:py-16">
            <Target className="h-8 w-8 md:h-12 md:w-12 text-muted-foreground mb-3 md:mb-4" />
            <h3 className="text-base md:text-lg font-semibold mb-1 md:mb-2">No budgets set</h3>
            <p className="text-muted-foreground text-center text-xs md:text-sm mb-4 md:mb-6">
              Create your first budget to start tracking spending
            </p>
            <Button onClick={() => handleOpenDialog()} className="text-xs md:text-sm h-8 md:h-10">
              <Plus className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
              Add Budget
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Transactions Modal */}
      <Dialog open={showTransactions} onOpenChange={setShowTransactions}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedBudget?.categories && (
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                  style={{ backgroundColor: `${selectedBudget.categories.color}20` }}
                >
                  {selectedBudget.categories.icon}
                </div>
              )}
              {selectedBudget?.categories?.name} Transactions
            </DialogTitle>
            <DialogDescription>
              {new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} •{' '}
              {categoryTransactions.length} transaction{categoryTransactions.length !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[60vh] pr-2">
            {loadingTransactions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : categoryTransactions.length > 0 ? (
              <div className="space-y-2">
                {categoryTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${tx.hidden ? 'opacity-50' : ''
                      }`}
                    onClick={() => setSelectedTransaction(tx)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {tx.logo_url && (
                        <img
                          src={tx.logo_url}
                          alt={tx.merchant_name || tx.description}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {tx.merchant_name || tx.description}
                          </span>
                          {tx.recurring && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex-shrink-0">
                              Recurring
                            </span>
                          )}
                          {tx.hidden && (
                            <span className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded flex-shrink-0">
                              Hidden
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <PrivateAmount
                      amount={tx.amount}
                      type={tx.transaction_type}
                      className={`font-semibold flex-shrink-0 ${tx.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'
                        }`}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">No transactions in this category for this month</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction Detail Dialog */}
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
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedTransaction.date).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <PrivateAmount
                  amount={selectedTransaction.amount}
                  type={selectedTransaction.transaction_type}
                  className={`text-lg font-semibold ${selectedTransaction.transaction_type === "credit" ? "text-green-600" : "text-red-600"
                    }`}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant={selectedTransaction.recurring ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    handleToggleRecurring(selectedTransaction.id, selectedTransaction.recurring || false)
                  }}
                  className="flex-1"
                >
                  <Repeat className="mr-2 h-4 w-4" />
                  {selectedTransaction.recurring ? "Recurring" : "Mark Recurring"}
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
