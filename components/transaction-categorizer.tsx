"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Sparkles, Check, Plus } from "lucide-react"

interface Category {
  id: string
  name: string
  color: string
  icon?: string
}

interface SmartSuggestion {
  categoryId: string
  confidence: number
  reason: string
}

interface TransactionCategorizerProps {
  transactionId: string
  description: string
  amount: number
  currentCategoryId?: string
  categories: Category[]
  onCategoryChange: (categoryId: string, newCategory?: Category) => void
}

const EMOJI_OPTIONS = [
  "🍔", "🛒", "⛽", "🏠", "💡", "🚗", "🎬", "👕", "💊", "🎓",
  "✈️", "🏥", "📱", "💰", "🎯", "🔧", "🎵", "📚", "🍕", "☕",
  "🏋️", "🎮", "💻", "🎨", "🌟", "💳", "🎪", "🚀", "⚡", "🔥"
]

export function TransactionCategorizer({
  transactionId,
  description,
  amount,
  currentCategoryId,
  categories,
  onCategoryChange,
}: TransactionCategorizerProps) {
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryIcon, setNewCategoryIcon] = useState("💰")
  const [newCategoryColor, setNewCategoryColor] = useState("#3b82f6")
  const [hasInteracted, setHasInteracted] = useState(false)

  const fetchSuggestions = async () => {
    if (loading || suggestions.length > 0) return
    
    setLoading(true)
    try {
      const response = await fetch("/api/category-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, amount }),
      })

      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.suggestions || [])
      }
    } catch (error) {
      console.error("Error fetching suggestions:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCategorySelect = async (categoryId: string) => {
    if (!transactionId || transactionId === 'undefined' || transactionId === 'null') {
      console.error('Invalid transaction ID:', transactionId)
      alert('Error: Invalid transaction ID. Please refresh the page and try again.')
      return
    }

    try {
      console.log('Updating transaction:', transactionId, 'with category:', categoryId)

      // Convert empty string to null, and validate categoryId
      const validCategoryId = categoryId === '' || categoryId === 'undefined' || categoryId === 'null' ? null : categoryId

      const response = await fetch(`/api/transactions/${transactionId}/category`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: validCategoryId }),
      })

      const result = await response.json()
      console.log('API response:', result)

      if (response.ok) {
        onCategoryChange(categoryId)
        
        // Learn from this assignment
        if (categoryId) {
          await fetch("/api/category-learning", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transactionId, categoryId }),
          })
        }
      } else {
        console.error("Failed to update category:", result)
        alert(`Failed to update category: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error("Error updating category:", error)
      alert('Error updating category. Please try again.')
    }
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return

    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategoryName,
          icon: newCategoryIcon,
          color: newCategoryColor,
        }),
      })

      if (response.ok) {
        const newCategory = await response.json()
        // Assign to transaction and pass new category back
        await handleCategorySelect(newCategory.id)
        onCategoryChange(newCategory.id, newCategory)
        // Reset form
        setNewCategoryName("")
        setNewCategoryIcon("💰")
        setNewCategoryColor("#3b82f6")
        setShowNewCategory(false)
      }
    } catch (error) {
      console.error("Error creating category:", error)
    }
  }

  const currentCategory = categories.find(c => c.id === currentCategoryId)

  return (
    <div className="space-y-2">
      {currentCategory ? (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleCategorySelect("")
          }}
          className="inline-flex items-center gap-1 px-2 h-8 rounded-md text-xs hover:opacity-80 transition-opacity cursor-pointer"
          style={{ backgroundColor: `${currentCategory.color}20`, color: currentCategory.color }}
          title="Click to change category"
        >
          {currentCategory.icon} {currentCategory.name}
        </button>
      ) : (
        <div className="space-y-2">
          {suggestions.length > 0 && (
            <div className="space-y-1">
              {suggestions.slice(0, 2).map((suggestion) => {
                const category = categories.find(c => c.id === suggestion.categoryId)
                if (!category) return null
                
                return (
                  <Button
                    key={suggestion.categoryId}
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs justify-start"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCategorySelect(suggestion.categoryId)
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.icon} {category.name}
                      <Badge variant="secondary" className="text-xs ml-1">
                        {Math.round(suggestion.confidence * 100)}%
                      </Badge>
                    </div>
                  </Button>
                )
              })}
            </div>
          )}

          <Select value="" onValueChange={(value) => {
            if (value === '__create_new__') {
              // Use setTimeout to ensure Select closes first
              setTimeout(() => setShowNewCategory(true), 100)
            } else if (value) {
              handleCategorySelect(value)
            }
          }} onOpenChange={(open) => {
            if (open) {
              setHasInteracted(true)
              if (!currentCategoryId && suggestions.length === 0) {
                fetchSuggestions()
              }
            }
          }}>
            <SelectTrigger className="h-8 text-xs" onClick={(e) => e.stopPropagation()}>
              <SelectValue placeholder="Select category..." />
            </SelectTrigger>
            <SelectContent onClick={(e) => e.stopPropagation()}>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id} onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    {category.icon} {category.name}
                  </div>
                </SelectItem>
              ))}
              <SelectItem value="__create_new__" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create new category
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <Dialog open={showNewCategory} onOpenChange={(open) => {
            // Only allow closing, not opening via external events
            if (!open) setShowNewCategory(false)
          }}>
            <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()} onPointerDownOutside={(e) => e.preventDefault()}>
                  <DialogHeader>
                    <DialogTitle>Create New Category</DialogTitle>
                    <DialogDescription>
                      Add a new category for your transactions
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Category Name</Label>
                      <Input
                        id="name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="e.g., Groceries"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Icon</Label>
                      <div className="grid grid-cols-10 gap-2">
                        {EMOJI_OPTIONS.map((emoji) => (
                          <Button
                            key={emoji}
                            variant={newCategoryIcon === emoji ? "default" : "outline"}
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setNewCategoryIcon(emoji)}
                          >
                            {emoji}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="color">Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="color"
                          type="color"
                          value={newCategoryColor}
                          onChange={(e) => setNewCategoryColor(e.target.value)}
                          className="w-16 h-8"
                        />
                        <div
                          className="flex-1 h-8 rounded border flex items-center justify-center text-sm"
                          style={{ backgroundColor: newCategoryColor, color: 'white' }}
                        >
                          {newCategoryIcon} {newCategoryName || "Preview"}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleCreateCategory} disabled={!newCategoryName.trim()}>
                        Create Category
                      </Button>
                      <Button variant="outline" onClick={() => setShowNewCategory(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
        </div>
      )}
    </div>
  )
}
