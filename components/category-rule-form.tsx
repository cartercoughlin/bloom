"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

interface Category {
  id: string
  name: string
  color: string
}

interface CategoryRuleFormProps {
  categories: Category[]
  initialData?: {
    id?: string
    name: string
    category_id: string
    priority: number
    is_active: boolean
    description_pattern?: string | null
    amount_min?: number | null
    amount_max?: number | null
    transaction_type?: 'debit' | 'credit' | null
    bank_pattern?: string | null
    account_pattern?: string | null
    institution_pattern?: string | null
  }
}

export function CategoryRuleForm({ categories, initialData }: CategoryRuleFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    category_id: initialData?.category_id || "",
    priority: initialData?.priority || 5,
    is_active: initialData?.is_active ?? true,
    description_pattern: initialData?.description_pattern || "",
    amount_min: initialData?.amount_min?.toString() || "",
    amount_max: initialData?.amount_max?.toString() || "",
    transaction_type: initialData?.transaction_type || "",
    bank_pattern: initialData?.bank_pattern || "",
    account_pattern: initialData?.account_pattern || "",
    institution_pattern: initialData?.institution_pattern || "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = initialData?.id
        ? `/api/category-rules/${initialData.id}`
        : "/api/category-rules"

      const method = initialData?.id ? "PUT" : "POST"

      // Convert form data to API format
      const payload = {
        name: formData.name,
        category_id: formData.category_id,
        priority: formData.priority,
        is_active: formData.is_active,
        description_pattern: formData.description_pattern || null,
        amount_min: formData.amount_min ? parseFloat(formData.amount_min) : null,
        amount_max: formData.amount_max ? parseFloat(formData.amount_max) : null,
        transaction_type: formData.transaction_type || null,
        bank_pattern: formData.bank_pattern || null,
        account_pattern: formData.account_pattern || null,
        institution_pattern: formData.institution_pattern || null,
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        router.push("/categories/rules")
        router.refresh()
      } else {
        const error = await response.json()
        console.error("Failed to save rule:", error)
        alert(`Failed to save rule: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error("Error saving rule:", error)
      alert('Error saving rule. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/categories/rules">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Rules
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{initialData?.id ? "Edit" : "Create"} Category Rule</CardTitle>
          <CardDescription>
            Rules automatically assign categories to transactions based on one or more conditions.
            All specified conditions must match for the rule to apply.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Rule Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Grocery Stores"
                required
              />
            </div>

            <div className="border-t pt-4 mt-4">
              <h3 className="font-medium mb-4">Rule Conditions (at least one required)</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Specify one or more conditions. A transaction must match ALL specified conditions for the rule to apply.
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pattern">Description Pattern (Regex)</Label>
                  <Input
                    id="pattern"
                    value={formData.description_pattern}
                    onChange={(e) => setFormData({ ...formData, description_pattern: e.target.value })}
                    placeholder="e.g., walmart|target|grocery"
                  />
                  <p className="text-sm text-muted-foreground">
                    Regular expression to match transaction description. Examples: "starbucks", "coffee|cafe"
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount_min">Minimum Amount</Label>
                    <Input
                      id="amount_min"
                      type="number"
                      step="0.01"
                      value={formData.amount_min}
                      onChange={(e) => setFormData({ ...formData, amount_min: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount_max">Maximum Amount</Label>
                    <Input
                      id="amount_max"
                      type="number"
                      step="0.01"
                      value={formData.amount_max}
                      onChange={(e) => setFormData({ ...formData, amount_max: e.target.value })}
                      placeholder="1000.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transaction_type">Transaction Type (Optional)</Label>
                  <Select
                    value={formData.transaction_type || undefined}
                    onValueChange={(value) => setFormData({ ...formData, transaction_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any type (no filter)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Debit (Expense)</SelectItem>
                      <SelectItem value="credit">Credit (Income)</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.transaction_type && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData({ ...formData, transaction_type: "" })}
                      className="h-6 text-xs"
                    >
                      Clear filter
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank_pattern">Bank Pattern (Regex)</Label>
                  <Input
                    id="bank_pattern"
                    value={formData.bank_pattern}
                    onChange={(e) => setFormData({ ...formData, bank_pattern: e.target.value })}
                    placeholder="e.g., chase|citi"
                  />
                  <p className="text-sm text-muted-foreground">
                    Match transactions from specific banks
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account_pattern">Account Pattern (Regex)</Label>
                  <Input
                    id="account_pattern"
                    value={formData.account_pattern}
                    onChange={(e) => setFormData({ ...formData, account_pattern: e.target.value })}
                    placeholder="e.g., checking|savings"
                  />
                  <p className="text-sm text-muted-foreground">
                    Match transactions from specific accounts
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="institution_pattern">Institution Pattern (Regex)</Label>
                  <Input
                    id="institution_pattern"
                    value={formData.institution_pattern}
                    onChange={(e) => setFormData({ ...formData, institution_pattern: e.target.value })}
                    placeholder="e.g., chase|wellsfargo"
                  />
                  <p className="text-sm text-muted-foreground">
                    Match transactions from specific institutions
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                min="1"
                max="10"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
              />
              <p className="text-sm text-muted-foreground">
                Higher priority rules are checked first (1-10)
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="active">Active</Label>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : initialData?.id ? "Update Rule" : "Create Rule"}
              </Button>
              <Link href="/categories/rules">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
