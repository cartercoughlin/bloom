"use client"

import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { Check, Plus, Tags } from "lucide-react"
import { toast } from "sonner"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import type { Tag } from "@/lib/tags"

const stop = (e: React.SyntheticEvent) => e.stopPropagation()

interface TagPickerProps {
  tags: Tag[]
  // Tags currently on the transaction(s); checked in the list
  selected?: string[]
  // "toggle": clicking a checked tag removes it. "add": every pick adds (bulk tagging).
  mode?: "toggle" | "add"
  onChange: (change: { add: string[]; remove: string[] }) => void
  onTagCreated: (tag: Tag) => void
  label?: string
  className?: string
}

export function TagPicker({ tags, selected = [], mode = "toggle", onChange, onTagCreated, label = "Tag", className }: TagPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)
  const isMobile = useIsMobile()
  const selectedSet = new Set(selected)

  const trimmed = search.trim()
  const exactMatch = tags.some(t => t.name.toLowerCase() === trimmed.toLowerCase())

  const pick = (tag: Tag) => {
    if (mode === "toggle" && selectedSet.has(tag.id)) onChange({ add: [], remove: [tag.id] })
    else if (!selectedSet.has(tag.id) || mode === "add") onChange({ add: [tag.id], remove: [] })
    if (mode === "add") setOpen(false)
  }

  const create = async () => {
    if (!trimmed || creating) return
    setCreating(true)
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Couldn't create tag")
      onTagCreated(json)
      onChange({ add: [json.id], remove: [] })
      setSearch("")
      if (mode === "add") setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create tag")
    } finally {
      setCreating(false)
    }
  }

  return (
    <span className="contents" onClick={stop}>
      <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch("") }}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className={cn("h-7 text-xs border-dashed", className)}>
            <Tags className="mr-1 h-3 w-3" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-64 p-0"
          align="start"
          onOpenAutoFocus={isMobile ? (e) => e.preventDefault() : undefined}
        >
          <Command>
            <CommandInput placeholder="Search or create a tag..." value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>{trimmed ? "No matching tag" : "No tags yet"}</CommandEmpty>
              {tags.length > 0 && (
                <CommandGroup heading={mode === "add" ? "Add tag" : "Tags"}>
                  {tags.map(tag => (
                    <CommandItem key={tag.id} value={`${tag.name}::${tag.id}`} onSelect={() => pick(tag)}>
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                      <span className="truncate">{tag.name}</span>
                      {mode === "toggle" && selectedSet.has(tag.id) && <Check className="ml-auto h-4 w-4" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {trimmed && !exactMatch && (
                <CommandGroup forceMount>
                  <CommandItem forceMount value={`__create__${trimmed}`} onSelect={create} disabled={creating}>
                    <Plus className="h-4 w-4" />
                    Create &ldquo;{trimmed}&rdquo;
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </span>
  )
}

// Small colored pills for a transaction's tags
export function TagChips({
  tags,
  max,
  onRemove,
  className,
}: {
  tags: Tag[]
  max?: number
  onRemove?: (tag: Tag) => void
  className?: string
}) {
  if (tags.length === 0) return null
  const shown = max ? tags.slice(0, max) : tags
  const extra = tags.length - shown.length
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {shown.map(tag => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none"
          style={{ backgroundColor: `${tag.color}1f`, color: tag.color }}
        >
          #{tag.name}
          {onRemove && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(tag) }}
              className="-mr-0.5 opacity-70 hover:opacity-100"
              aria-label={`Remove tag ${tag.name}`}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {extra > 0 && <span className="text-[11px] text-muted-foreground">+{extra}</span>}
    </span>
  )
}
