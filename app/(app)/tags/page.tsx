'use client'

import { useCallback, useState } from "react"
import Link from "next/link"
import { ChevronRight, Loader2, Pencil, Plus, Tags } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { PrivateAmount } from "@/components/private-amount"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { useAppData, CACHE_KEYS } from "@/contexts/app-data-context"
import { useCachedData } from "@/hooks/use-cached-data"
import { cn } from "@/lib/utils"
import { MIGRATION_HINT, TAG_COLORS, type TagWithStats } from "@/lib/tags"

interface TagsPageData {
  tags: TagWithStats[]
  needsMigration: boolean
}

async function fetchTags(): Promise<TagsPageData> {
  const res = await fetch("/api/tags", { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to load tags")
  return res.json()
}

const shortDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function TagsPage() {
  const appData = useAppData()
  const fetcher = useCallback(fetchTags, [])
  const { data, loading, refreshing, refresh } = useCachedData(`${CACHE_KEYS.tags}page-v1`, fetcher)
  const [editing, setEditing] = useState<TagWithStats | "new" | null>(null)

  const onSaved = () => {
    setEditing(null)
    // Tag names/colors also show on the Transactions page
    appData.markStale([CACHE_KEYS.tags, CACHE_KEYS.transactions])
    refresh()
  }

  if (loading && !data) {
    return (
      <div className="container mx-auto p-3 md:p-6 max-w-3xl pb-20 md:pb-6 space-y-3">
        <Skeleton className="h-8 w-32" />
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    )
  }

  const tags = data?.tags || []

  return (
    <div className="container mx-auto p-3 md:p-6 max-w-3xl pb-20 md:pb-6">
      <PullToRefresh onRefresh={refresh} />
      <div className="flex items-start justify-between gap-3 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-3xl font-bold mb-1 text-green-600 flex items-center gap-2">
            Tags
            {refreshing && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </h1>
          <p className="text-muted-foreground text-xs md:text-sm">
            Track trips, projects and savings goals across categories. Tags don&apos;t affect your budgets.
          </p>
        </div>
        <Button onClick={() => setEditing("new")} disabled={data?.needsMigration} className="h-8 md:h-10 text-xs md:text-sm flex-shrink-0">
          <Plus className="mr-1 h-4 w-4" />
          New tag
        </Button>
      </div>

      {data?.needsMigration ? (
        <Card className="rounded-xl">
          <CardContent className="p-5 text-sm text-muted-foreground">{MIGRATION_HINT}.</CardContent>
        </Card>
      ) : tags.length === 0 ? (
        <Card className="rounded-xl">
          <CardContent className="py-10 text-center space-y-2">
            <Tags className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="font-medium">No tags yet</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Create a tag like &ldquo;Japan trip&rdquo; or &ldquo;Kitchen remodel&rdquo;, then add it to transactions from their
              details or by selecting several at once.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tags.map(tag => <TagCard key={tag.id} tag={tag} onEdit={() => setEditing(tag)} />)}
        </div>
      )}

      <TagDialog tag={editing} onClose={() => setEditing(null)} onSaved={onSaved} />
    </div>
  )
}

function TagCard({ tag, onEdit }: { tag: TagWithStats; onEdit: () => void }) {
  const target = tag.target_amount
  const pct = target ? Math.min(100, (tag.spent / target) * 100) : 0
  const over = target !== null && tag.spent > target

  return (
    <Card className="rounded-xl transition-colors hover:bg-muted/40">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Link href={`/transactions?tag=${tag.id}`} className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
              <span className="font-semibold truncate">{tag.name}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {tag.transactionCount} transaction{tag.transactionCount === 1 ? "" : "s"}
              {tag.firstDate && tag.lastDate && (
                <> · {tag.firstDate === tag.lastDate ? shortDate(tag.firstDate) : `${shortDate(tag.firstDate)} – ${shortDate(tag.lastDate)}`}</>
              )}
            </p>
          </Link>
          <div className="text-right flex-shrink-0">
            <PrivateAmount amount={tag.spent} decimals={0} className="text-lg font-bold tabular-nums" />
            {target !== null && (
              <p className="text-[11px] text-muted-foreground">
                of <PrivateAmount amount={target} decimals={0} />
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 -mr-1" onClick={onEdit} aria-label={`Edit ${tag.name}`}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>

        {target !== null && (
          <div className="mt-3">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: over ? "#dc2626" : tag.color }} />
            </div>
            <p className={cn("mt-1 text-[11px]", over ? "text-red-600" : "text-muted-foreground")}>
              {over
                ? <><PrivateAmount amount={tag.spent - target} decimals={0} /> over target</>
                : <><PrivateAmount amount={target - tag.spent} decimals={0} /> left</>}
            </p>
          </div>
        )}

        <Link href={`/transactions?tag=${tag.id}`} className="mt-2 flex items-center text-xs font-medium text-green-600">
          View transactions <ChevronRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  )
}

function TagDialog({ tag, onClose, onSaved }: { tag: TagWithStats | "new" | null; onClose: () => void; onSaved: () => void }) {
  const isNew = tag === "new"
  const existing = tag && tag !== "new" ? tag : null
  const [name, setName] = useState("")
  const [color, setColor] = useState(TAG_COLORS[0])
  const [target, setTarget] = useState("")
  const [saving, setSaving] = useState(false)
  const [openFor, setOpenFor] = useState<string | null>(null)

  // Reset the form each time the dialog opens for a different tag
  const key = tag === null ? null : isNew ? "new" : existing!.id
  if (key !== openFor) {
    setOpenFor(key)
    setName(existing?.name || "")
    setColor(existing?.color || TAG_COLORS[0])
    setTarget(existing?.target_amount != null ? String(existing.target_amount) : "")
  }

  const save = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch(isNew ? "/api/tags" : `/api/tags/${existing!.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color, target_amount: target.trim() === "" ? null : Number(target) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Couldn't save tag")
      toast.success(isNew ? `Created #${json.name}` : "Tag updated")
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save tag")
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!existing) return
    const res = await fetch(`/api/tags/${existing.id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Couldn't delete tag")
      return
    }
    toast.success(`Deleted #${existing.name}`)
    onSaved()
  }

  return (
    <Dialog open={tag !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? "New tag" : "Edit tag"}</DialogTitle>
          <DialogDescription>Group spending for a trip, project or goal across any categories.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save() }}>
          <div className="space-y-2">
            <Label htmlFor="tag-name">Name</Label>
            <Input id="tag-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="e.g. Japan trip" />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn("h-7 w-7 rounded-full border-2", color === c ? "border-foreground" : "border-transparent")}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tag-target">Target (optional)</Label>
            <Input
              id="tag-target"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="e.g. 2000 for a trip budget"
            />
          </div>
          <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
            {existing ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" className="text-destructive">Delete</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete #{existing.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The tag is removed from {existing.transactionCount} transaction{existing.transactionCount === 1 ? "" : "s"}.
                      The transactions themselves aren&apos;t changed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={remove} className="bg-destructive text-white hover:bg-destructive/90">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : <span />}
            <Button type="submit" disabled={!name.trim() || saving}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {isNew ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
