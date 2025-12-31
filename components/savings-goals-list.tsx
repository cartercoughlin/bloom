"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { cache } from "@/lib/capacitor"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Edit, Trash2, Loader2, PiggyBank } from "lucide-react"
import { useRouter } from "next/navigation"
import { PrivateAmount } from "./private-amount"

interface SavingsGoal {
  id: string
  amount: number
  category_id: string
  categories: {
    id: string
    name: string
    color: string
    icon: string | null
    target_amount?: number | null
  } | null
}

interface SavingsGoalsListProps {
  savingsGoals: SavingsGoal[]
  netByCategory: Record<string, {
    income: number
    expenses: number
    net: number
    recurringExpenses: number
    variableExpenses: number
  }>
  rolloverByCategory: Record<string, number>
  month: number
  year: number
  onEdit: (goalId: string) => void
}

export function SavingsGoalsList({
  savingsGoals: initialSavingsGoals,
  netByCategory,
  rolloverByCategory,
  month,
  year,
  onEdit
}: SavingsGoalsListProps) {
  const [savingsGoals, setSavingsGoals] = useState(initialSavingsGoals)
  const [showTransactions, setShowTransactions] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null)
  const [categoryTransactions, setCategoryTransactions] = useState<any[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const router = useRouter()

  const handleShowTransactions = async (goal: SavingsGoal) => {
    setSelectedGoal(goal)
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

      const { data, error } = await supabase
        .from("transactions")
        .select("id, date, description, amount, transaction_type, merchant_name, logo_url, hidden, recurring")
        .eq("user_id", user.id)
        .eq("category_id", goal.category_id)
        .gte("date", firstDay)
        .lte("date", lastDay)
        .or("deleted.is.null,deleted.eq.false")
        .order("date", { ascending: false })

      if (error) throw error

      setCategoryTransactions(data || [])
    } catch (error) {
      console.error("Error loading transactions:", error)
      setCategoryTransactions([])
    } finally {
      setLoadingTransactions(false)
    }
  }

  const handleDelete = async (goalId: string) => {
    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { error } = await supabase
        .from("budgets")
        .delete()
        .eq("id", goalId)
        .eq("user_id", user.id)

      if (error) throw error

      // Invalidate cache to force fresh data load
      await cache.removePattern(`budgets-${year}-${month}`)
      await cache.removePattern(`dashboard-${year}-${month}`)

      setSavingsGoals(savingsGoals.filter((g) => g.id !== goalId))
      // Force page reload to get fresh data
      window.location.reload()
    } catch (error) {
      console.error("Error deleting savings goal:", error)
    }
  }

  if (savingsGoals.length === 0) {
    return null
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg md:text-2xl font-bold">Savings Goals</h2>
          <p className="text-muted-foreground text-xs md:text-sm">Track your savings and rollover categories</p>
        </div>
      </div>

      <div className="grid gap-3 md:gap-4">
        {savingsGoals.map((goal) => {
          const categoryData = netByCategory[goal.category_id] || {
            income: 0,
            expenses: 0,
            net: 0,
            recurringExpenses: 0,
            variableExpenses: 0,
          }
          const expenses = categoryData.expenses
          const income = categoryData.income
          const netSpending = Math.max(0, expenses - income)

          // Get rollover from previous month
          const rollover = rolloverByCategory[goal.category_id] || 0

          // Calculate accumulated balance
          const monthlyContribution = Number(goal.amount)
          const accumulatedBalance = rollover + monthlyContribution - netSpending

          // Target amount
          const targetAmount = goal.categories?.target_amount
          const progressPercentage = targetAmount ? (accumulatedBalance / targetAmount) * 100 : 0

          return (
            <Card
              key={goal.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => handleShowTransactions(goal)}
            >
              <CardHeader className="pb-3 md:pb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 md:gap-3">
                    {goal.categories && (
                      <div
                        className="w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center text-base md:text-xl"
                        style={{ backgroundColor: `${goal.categories.color}20` }}
                      >
                        {goal.categories.icon}
                      </div>
                    )}
                    <div className="flex-1">
                      <CardTitle className="text-sm md:text-lg flex items-center gap-2">
                        {goal.categories?.name}
                        <PiggyBank className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
                      </CardTitle>
                      <CardDescription className="text-xs md:text-sm">
                        Monthly: <PrivateAmount amount={monthlyContribution} className="inline" /> •
                        Balance: <PrivateAmount amount={accumulatedBalance} className="inline" />
                        {rollover > 0 && (
                          <span className="text-green-600 ml-2">
                            • <PrivateAmount amount={rollover} prefix="$" className="inline" /> from last month
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 md:gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdit(goal.id)
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
                          <AlertDialogTitle>Delete Savings Goal?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete the savings goal for {goal.categories?.name}? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(goal.id)}
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
                {targetAmount && (
                  <>
                    <div className="relative">
                      <Progress
                        value={Math.min(progressPercentage, 100)}
                        className="h-1.5 md:h-2"
                        indicatorClassName="bg-blue-600"
                      />
                    </div>
                    <div className="flex justify-between text-xs md:text-sm">
                      <span className="text-muted-foreground">
                        {progressPercentage.toFixed(1)}% of goal
                      </span>
                      <span className="text-blue-600">
                        <PrivateAmount amount={Math.abs(targetAmount - accumulatedBalance)} className="inline" /> {accumulatedBalance >= targetAmount ? 'over goal' : 'to go'}
                      </span>
                    </div>
                  </>
                )}
                {!targetAmount && (
                  <div className="text-xs md:text-sm text-muted-foreground">
                    No target set • Current balance: <PrivateAmount amount={accumulatedBalance} prefix="$" className="inline" />
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Transactions Modal */}
      <Dialog open={showTransactions} onOpenChange={setShowTransactions}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedGoal?.categories && (
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                  style={{ backgroundColor: `${selectedGoal.categories.color}20` }}
                >
                  {selectedGoal.categories.icon}
                </div>
              )}
              {selectedGoal?.categories?.name} Transactions
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
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      tx.hidden ? 'opacity-50' : ''
                    }`}
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
                      className={`font-semibold flex-shrink-0 ${
                        tx.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'
                      }`}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">No transactions in this savings goal for this month</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
