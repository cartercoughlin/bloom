"use client"

import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Check, ChevronDown, Plus, Sparkles, Tag, X } from "lucide-react"
import { toast } from "sonner"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

export interface PickerCategory {
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

interface CategoryPickerProps {
  categories: PickerCategory[]
  value?: string | null
  // `created` is set when the category was just created from the picker
  onSelect: (categoryId: string | null, created?: PickerCategory) => void
  onCategoryCreated?: (category: PickerCategory) => void
  // When set, smart suggestions are fetched for this transaction on first open
  suggestionFor?: { transactionId: string; description: string; amount: number }
  // Replaces the default trigger label (e.g. "Categorize 3")
  label?: string
  className?: string
}

const EMOJI_OPTIONS = [
  "🍔", "🛒", "⛽", "🏠", "💡", "🚗", "🎬", "👕", "💊", "🎓",
  "✈️", "🏥", "📱", "💰", "🎯", "🔧", "🎵", "📚", "🍕", "☕",
  "🏋️", "🎮", "💻", "🎨", "🌟", "💳", "🎪", "🚀", "⚡", "🔥"
]

const stop = (e: React.SyntheticEvent) => e.stopPropagation()

export function CategoryPicker({
  categories,
  value,
  onSelect,
  onCategoryCreated,
  suggestionFor,
  label,
  className,
}: CategoryPickerProps) {
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<SmartSuggestion[] | null>(null)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const isMobile = useIsMobile()

  const current = categories.find(c => c.id === value)

  const fetchSuggestions = async () => {
    if (!suggestionFor || suggestions !== null || loadingSuggestions) return
    setLoadingSuggestions(true)
    try {
      const response = await fetch("/api/category-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(suggestionFor),
      })
      const data = response.ok ? await response.json() : null
      setSuggestions(data?.suggestions || [])
    } catch (error) {
      console.error("Error fetching category suggestions:", error)
      setSuggestions([])
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) fetchSuggestions()
  }

  const choose = (categoryId: string | null) => {
    setOpen(false)
    if (categoryId !== (value || null)) onSelect(categoryId)
  }

  const suggested = (suggestions || [])
    .filter(s => s.categoryId !== value)
    .map(s => ({ suggestion: s, category: categories.find(c => c.id === s.categoryId) }))
    .filter((s): s is { suggestion: SmartSuggestion; category: PickerCategory } => !!s.category)
    .sort((a, b) => b.suggestion.confidence - a.suggestion.confidence)
    .slice(0, 3)

  return (
    // Rows render this inside clickable containers, and React events bubble
    // through Radix portals, so keep picker/dialog clicks from reaching the row.
    <span className="contents" onClick={stop}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          {current && !label ? (
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 px-2 h-7 rounded-md text-xs font-medium hover:opacity-80 transition-opacity",
                className
              )}
              style={{ backgroundColor: `${current.color}20`, color: current.color }}
              title="Change category"
            >
              {current.icon} {current.name}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("h-7 text-xs border-dashed", className)}
            >
              <Tag className="mr-1 h-3 w-3" />
              {label || "Categorize"}
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent
          className="w-64 p-0"
          align="start"
          // On phones, opening the keyboard immediately hides most of the list
          onOpenAutoFocus={isMobile ? (e) => e.preventDefault() : undefined}
        >
          <Command>
            <CommandInput placeholder="Search categories..." />
            <CommandList>
              <CommandEmpty>No matching category</CommandEmpty>

              {(loadingSuggestions || suggested.length > 0) && (
                <CommandGroup heading={loadingSuggestions ? "Finding suggestions..." : "Suggested"}>
                  {suggested.map(({ suggestion, category }) => (
                    <CommandItem
                      key={`suggested-${category.id}`}
                      value={`${category.name}::${category.id}::suggested`}
                      onSelect={() => choose(category.id)}
                    >
                      <CategoryLabel category={category} />
                      <Badge variant="secondary" className="ml-auto text-[10px] px-1.5">
                        <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                        {Math.round(suggestion.confidence * 100)}%
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              <CommandGroup heading="All categories">
                {categories.map(category => (
                  <CommandItem
                    key={category.id}
                    value={`${category.name}::${category.id}`}
                    onSelect={() => choose(category.id)}
                  >
                    <CategoryLabel category={category} />
                    {category.id === value && <Check className="ml-auto h-4 w-4" />}
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  value="__create_new__"
                  onSelect={() => {
                    setOpen(false)
                    setShowNewCategory(true)
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Create new category
                </CommandItem>
                {value && (
                  <CommandItem value="__remove__" onSelect={() => choose(null)}>
                    <X className="h-4 w-4" />
                    Remove category
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <NewCategoryDialog
        open={showNewCategory}
        onOpenChange={setShowNewCategory}
        onCreated={(category) => {
          onCategoryCreated?.(category)
          onSelect(category.id, category)
        }}
      />
    </span>
  )
}

function CategoryLabel({ category }: { category: PickerCategory }) {
  return (
    <span className="flex items-center gap-2 min-w-0">
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />
      <span className="truncate">{category.icon} {category.name}</span>
    </span>
  )
}

function NewCategoryDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (category: PickerCategory) => void
}) {
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("💰")
  const [color, setColor] = useState("#3b82f6")
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setName("")
    setIcon("💰")
    setColor("#3b82f6")
  }

  const handleCreate = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), icon, color }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to create category")
      onCreated(result)
      reset()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create category")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Category</DialogTitle>
          <DialogDescription>Add a new category for your transactions</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-category-name">Category Name</Label>
            <Input
              id="new-category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate() }}
              placeholder="e.g., Groceries"
            />
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="grid grid-cols-10 gap-2">
              {EMOJI_OPTIONS.map((emoji) => (
                <Button
                  key={emoji}
                  type="button"
                  variant={icon === emoji ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setIcon(emoji)}
                >
                  {emoji}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-category-color">Color</Label>
            <div className="flex gap-2">
              <Input
                id="new-category-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-16 h-8"
              />
              <div
                className="flex-1 h-8 rounded border flex items-center justify-center text-sm"
                style={{ backgroundColor: color, color: "white" }}
              >
                {icon} {name || "Preview"}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={!name.trim() || saving}>
              Create Category
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
