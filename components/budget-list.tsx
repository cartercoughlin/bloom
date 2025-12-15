"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Plus, Edit, Trash2, Loader2, Target } from "lucide-react"
import { useRouter } from "next/navigation"

interface Budget {
  id: string
  amount: number
  category_id: string
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
  month: number
  year: number
}

export function BudgetList({
  budgets: initialBudgets,
  categories: initialCategories,
  netByCategory,
  spending,
  month,
  year
}: BudgetListProps) {
  const [budgets, setBudgets] = useState(initialBudgets)
  const [categories, setCategories] = useState(initialCategories)
  const [isOpen, setIsOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState("")
  const [amount, setAmount] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

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
    const { data } = await supabase.from("categories").select("*").order("name")
    if (data) {
      setCategories(data)
    }
  }

  const handleOpenDialog = async (budget?: Budget) => {
    // Fetch latest categories to include any newly created ones
    await fetchLatestCategories()

    if (budget) {
      setEditingBudget(budget)
      setSelectedCategoryId(budget.category_id)
      setAmount(budget.amount.toString())
    } else {
      setEditingBudget(null)
      setSelectedCategoryId("")
      setAmount("")
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
          .update({ amount: Number.parseFloat(amount) })
          .eq("id", editingBudget.id)

        if (error) throw error
      } else {
        // Create new budget
        const { error } = await supabase.from("budgets").insert({
          user_id: user.id,
          category_id: selectedCategoryId,
          amount: Number.parseFloat(amount),
          month,
          year,
        })

        if (error) throw error
      }

      setIsOpen(false)
      router.refresh()
    } catch (error) {
      console.error("Error saving budget:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (budgetId: string) => {
    const supabase = createClient()

    try {
      const { error } = await supabase.from("budgets").delete().eq("id", budgetId)

      if (error) throw error

      setBudgets(budgets.filter((b) => b.id !== budgetId))
      router.refresh()
    } catch (error) {
      console.error("Error deleting budget:", error)
    }
  }

  const usedCategoryIds = budgets.map((b) => b.category_id)
  const availableCategories = categories.filter((c) => !usedCategoryIds.includes(c.id) || c.id === selectedCategoryId)

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg md:text-2xl font-bold">Category Budgets</h2>
          <p className="text-muted-foreground text-xs md:text-sm">Set spending limits for each category</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
                <Label htmlFor="category">Category</Label>
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

            // For income categories (income > expenses), net is negative, so don't show budget usage
            // For expense categories, show net spending (expenses - income) against budget
            const netSpending = Math.max(0, expenses - income) // Don't go negative
            const percentage = (netSpending / Number(budget.amount)) * 100
            const isOverBudget = netSpending > Number(budget.amount)
            const isIncomeCategory = income > expenses

            // Calculate expected spending considering recurring vs variable expenses
            // Recurring expenses are expected immediately, variable expenses scale through the month
            const calculateExpectedSpending = () => {
              if (percentageThroughMonth === null) return 0

              // Expected spending should be based on budget, not historical spending
              // Recurring expenses are expected immediately, remaining budget scales with time
              const netRecurringExpenses = Math.max(0, recurringExpenses - income)
              const remainingBudgetAfterRecurring = Math.max(0, Number(budget.amount) - netRecurringExpenses)
              
              // Expected = recurring (immediate) + remaining budget (scaled by time)
              const expected = netRecurringExpenses + (remainingBudgetAfterRecurring * (percentageThroughMonth / 100))
              
              // Debug for wants category
              if (budget.categories?.name === 'Wants') {
                console.log('Wants category debug (fixed):', {
                  percentageThroughMonth,
                  budgetAmount: Number(budget.amount),
                  netRecurringExpenses,
                  remainingBudgetAfterRecurring,
                  expected,
                  expectedPercentage: (expected / Number(budget.amount)) * 100
                })
              }
              
              return expected
            }

            const expectedSpending = calculateExpectedSpending()

            return (
              <Card key={budget.id}>
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
                      <div>
                        <CardTitle className="text-sm md:text-lg">{budget.categories?.name}</CardTitle>
                        <CardDescription className="text-xs md:text-sm">
                          {isIncomeCategory ? (
                            <>
                              Income: ${income.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                              {expenses > 0 && <span className="text-muted-foreground ml-2">• Expenses: ${expenses.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>}
                            </>
                          ) : (
                            <>
                              Net Spending: ${netSpending.toLocaleString('en-US', { maximumFractionDigits: 0 })} of ${Number(budget.amount).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                              {income > 0 && (
                                <span className="text-green-600 ml-2">
                                  • Income offset: ${income.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                </span>
                              )}
                            </>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-sm md:text-base font-bold ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {net >= 0 ? '+' : '-'}${Math.abs(net).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                      <div className="flex items-center gap-1 md:gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(budget)} className="h-7 w-7 md:h-9 md:w-9">
                          <Edit className="h-3 w-3 md:h-4 md:w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(budget.id)} className="h-7 w-7 md:h-9 md:w-9">
                          <Trash2 className="h-3 w-3 md:h-4 md:w-4 text-destructive" />
                        </Button>
                      </div>
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
                        className="absolute -top-0.5 -bottom-0.5 md:-top-1 md:-bottom-1 w-0.5 bg-blue-500 z-10"
                        style={{ left: `${Math.min((expectedSpending / Number(budget.amount)) * 100, 100)}%` }}
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
                        ? `Net: +$${Math.abs(net).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                        : `$${Math.abs(Number(budget.amount) - netSpending).toLocaleString('en-US', { maximumFractionDigits: 0 })} ${isOverBudget ? "over budget" : "remaining"}`
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
    </div>
  )
}
