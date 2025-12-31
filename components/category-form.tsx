"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cache } from "@/lib/capacitor"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { AlertCircle, Loader2 } from "lucide-react"

interface Category {
  id: string
  name: string
  color: string
  icon: string | null
  is_rollover?: boolean
  target_amount?: number | null
}

const PRESET_COLORS = [
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#22C55E",
  "#6B7280",
]

export function CategoryForm({ category }: { category?: Category }) {
  const [name, setName] = useState(category?.name || "")
  const [color, setColor] = useState(category?.color || "#3B82F6")
  const [icon, setIcon] = useState(category?.icon || "📦")
  const [isRollover, setIsRollover] = useState(category?.is_rollover || false)
  const [targetAmount, setTargetAmount] = useState<string>(category?.target_amount?.toString() || "")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const categoryData = {
        name,
        color,
        icon,
        is_rollover: isRollover,
        target_amount: isRollover && targetAmount ? parseFloat(targetAmount) : null,
      }

      if (category) {
        // Update existing category
        const { error: updateError } = await supabase
          .from("categories")
          .update(categoryData)
          .eq("id", category.id)

        if (updateError) throw updateError
      } else {
        // Create new category
        const { error: insertError } = await supabase.from("categories").insert({
          user_id: user.id,
          ...categoryData,
        })

        if (insertError) throw insertError
      }

      // Invalidate all budget and dashboard caches since categories affect all months
      await cache.removePattern('budgets-')
      await cache.removePattern('dashboard-')

      router.push("/categories")
      // Force page reload to get fresh data
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save category")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Category Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Groceries"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="icon">Icon (Emoji)</Label>
            <Input
              id="icon"
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="Enter any emoji 🛒"
              className="text-2xl text-center"
              maxLength={4}
            />
            <p className="text-xs text-muted-foreground">
              Enter any emoji to represent this category
            </p>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="grid grid-cols-6 md:grid-cols-9 gap-2">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  onClick={() => setColor(presetColor)}
                  className={`w-10 h-10 md:w-12 md:h-12 rounded-lg transition-all ${
                    color === presetColor ? "ring-2 ring-primary scale-110" : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: presetColor }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Label htmlFor="custom-color" className="text-xs md:text-sm">Custom Color:</Label>
              <input
                id="custom-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-16 h-8 md:w-20 md:h-10 rounded cursor-pointer"
              />
              <span className="text-xs md:text-sm text-muted-foreground">{color}</span>
            </div>
          </div>

          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="rollover">Savings Goal / Rollover Category</Label>
                <p className="text-xs text-muted-foreground">
                  Unused budget carries over to next month
                </p>
              </div>
              <Switch
                id="rollover"
                checked={isRollover}
                onCheckedChange={setIsRollover}
              />
            </div>

            {isRollover && (
              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="target-amount">Target Amount (Optional)</Label>
                <Input
                  id="target-amount"
                  type="number"
                  step="0.01"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="e.g., 2000"
                />
                <p className="text-xs text-muted-foreground">
                  Set a savings goal target for this category
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 md:gap-4 p-3 md:p-4 bg-muted rounded-lg">
            <div
              className="w-12 h-12 md:w-16 md:h-16 rounded-lg flex items-center justify-center text-2xl md:text-3xl"
              style={{ backgroundColor: `${color}20` }}
            >
              {icon}
            </div>
            <div>
              <p className="font-semibold text-sm md:text-base">{name || "Category Name"}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Preview</p>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs md:text-sm">{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3 md:gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isLoading}
              className="flex-1 text-xs md:text-sm h-9 md:h-10"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1 text-xs md:text-sm h-9 md:h-10">
              {isLoading ? (
                <>
                  <Loader2 className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4 animate-spin" />
                  <span className="hidden sm:inline">Saving...</span>
                  <span className="sm:hidden">Save</span>
                </>
              ) : (
                <>{category ? "Update" : "Create"} Category</>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
