"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"

interface Budget {
  id: string
  name: string
  allocated_amount: number
  spent_amount: number
  available_amount: number
}

interface BudgetAllocatorProps {
  budgets: Budget[]
  availableToAllocate: number
  onAllocate: (budgetId: string, amount: number) => void
}

export function BudgetAllocator({ budgets, availableToAllocate, onAllocate }: BudgetAllocatorProps) {
  const [allocations, setAllocations] = useState<Record<string, string>>({})
  const [totalAllocated, setTotalAllocated] = useState(0)

  useEffect(() => {
    const total = Object.values(allocations).reduce((sum, amount) => {
      return sum + (parseFloat(amount) || 0)
    }, 0)
    setTotalAllocated(total)
  }, [allocations])

  const handleAllocationChange = (budgetId: string, value: string) => {
    setAllocations(prev => ({
      ...prev,
      [budgetId]: value
    }))
  }

  const handleAllocate = (budgetId: string) => {
    const amount = parseFloat(allocations[budgetId] || '0')
    if (amount > 0) {
      onAllocate(budgetId, amount)
      setAllocations(prev => ({
        ...prev,
        [budgetId]: ''
      }))
    }
  }

  const remainingToAllocate = availableToAllocate - totalAllocated

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget Allocation</CardTitle>
        <CardDescription>
          Allocate your available money to budget categories
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Available Money Summary */}
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Available to Allocate</span>
            <span className="text-lg font-bold">${availableToAllocate.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">Currently Allocating</span>
            <span className="text-sm">${totalAllocated.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Remaining</span>
            <span className={`text-sm font-bold ${remainingToAllocate < 0 ? 'text-red-500' : 'text-green-600'}`}>
              ${remainingToAllocate.toFixed(2)}
            </span>
          </div>
          <Progress 
            value={Math.min((totalAllocated / availableToAllocate) * 100, 100)} 
            className="mt-2"
          />
        </div>

        {/* Budget Categories */}
        <div className="space-y-4">
          {budgets.map((budget) => (
            <div key={budget.id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-medium">{budget.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    Allocated: ${budget.allocated_amount.toFixed(2)} |
                    Available: ${budget.available_amount.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor={`allocation-${budget.id}`} className="text-xs text-muted-foreground mb-1">
                    Set allocation amount
                  </Label>
                  <Input
                    id={`allocation-${budget.id}`}
                    type="number"
                    step="0.01"
                    placeholder={budget.allocated_amount > 0 ? budget.allocated_amount.toFixed(2) : "0.00"}
                    value={allocations[budget.id] || ''}
                    onChange={(e) => handleAllocationChange(budget.id, e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    onClick={() => handleAllocate(budget.id)}
                    disabled={!allocations[budget.id]}
                    size="sm"
                  >
                    {budget.allocated_amount > 0 ? 'Update' : 'Set'}
                  </Button>
                  {budget.allocated_amount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAllocationChange(budget.id, budget.allocated_amount.toString())}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
