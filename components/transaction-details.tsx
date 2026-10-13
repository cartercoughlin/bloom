"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Eye, EyeOff, ExternalLink, Repeat, Trash2 } from "lucide-react"
import { CategoryPicker } from "./category-picker"
import { PrivateAmount } from "./private-amount"
import { TransactionAvatar } from "./transaction-avatar"
import { TagChips, TagPicker } from "./tag-picker"
import type { Tag } from "@/lib/tags"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Category,
  Transaction,
  accountLabel,
  displayName,
  fullAddress,
  parseLocalDate,
  paymentChannelLabel,
  plaidCategoryPath,
} from "@/lib/transaction-display"

interface TransactionDetailsProps {
  transaction: Transaction | null
  categories: Category[]
  onClose: () => void
  onCategorize: (tx: Transaction, categoryId: string | null, created?: Category) => void
  onCategoryCreated: (category: Category) => void
  onToggleRecurring: (tx: Transaction) => void
  onToggleHidden: (tx: Transaction) => void
  onDelete: (tx: Transaction) => void
  tags: Tag[]
  onTagsChange: (tx: Transaction, change: { add: string[]; remove: string[] }) => void
  onTagCreated: (tag: Tag) => void
}

// Bottom sheet on phones, centered dialog on larger screens
export function TransactionDetails(props: TransactionDetailsProps) {
  const isMobile = useIsMobile()
  const { transaction, onClose } = props
  const open = !!transaction
  const onOpenChange = (next: boolean) => { if (!next) onClose() }

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Transaction Details</DrawerTitle>
          </DrawerHeader>
          <div
            className="overflow-y-auto px-4 pt-2"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
          >
            {transaction && <DetailsBody {...props} transaction={transaction} />}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transaction Details</DialogTitle>
        </DialogHeader>
        {transaction && <DetailsBody {...props} transaction={transaction} />}
      </DialogContent>
    </Dialog>
  )
}

function DetailsBody({
  transaction: tx,
  categories,
  onCategorize,
  onCategoryCreated,
  onToggleRecurring,
  onToggleHidden,
  onDelete,
  tags,
  onTagsChange,
  onTagCreated,
}: TransactionDetailsProps & { transaction: Transaction }) {
  const details = tx.plaid_details
  const date = parseLocalDate(tx.date)
  const authorized = details?.authorized_date && details.authorized_date !== tx.date
    ? parseLocalDate(details.authorized_date)
    : null
  const time = details?.datetime
    ? new Date(details.datetime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null
  const bankDescription = tx.description !== displayName(tx) ? tx.description : null
  const counterparties = (details?.counterparties || []).filter(c => c.name !== displayName(tx))
  const website = tx.website || details?.counterparties?.find(c => c.website)?.website

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col items-center text-center gap-2 pt-1">
        <TransactionAvatar transaction={tx} categories={categories} size="lg" />
        <div>
          <h3 className="font-semibold text-lg leading-tight">{displayName(tx)}</h3>
          <PrivateAmount
            amount={tx.amount}
            type={tx.transaction_type}
            className={`text-2xl font-semibold ${tx.transaction_type === "credit" ? "text-green-600" : "text-foreground"}`}
          />
          {details?.pending && (
            <p className="text-xs font-medium text-amber-600 mt-0.5">Pending</p>
          )}
        </div>
        <CategoryPicker
          categories={categories}
          value={tx.category_id}
          suggestionFor={{ transactionId: tx.id, description: tx.description, amount: tx.amount }}
          onSelect={(categoryId, created) => onCategorize(tx, categoryId, created)}
          onCategoryCreated={onCategoryCreated}
        />
        {/* Tags: trips, projects, goals; separate from the budget category */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <TagChips
            tags={(tx.tag_ids || []).map(id => tags.find(t => t.id === id)).filter((t): t is Tag => !!t)}
            onRemove={(tag) => onTagsChange(tx, { add: [], remove: [tag.id] })}
          />
          <TagPicker
            tags={tags}
            selected={tx.tag_ids || []}
            onChange={(change) => onTagsChange(tx, change)}
            onTagCreated={onTagCreated}
            label={(tx.tag_ids || []).length > 0 ? "Edit tags" : "Add tag"}
          />
        </div>
      </div>

      {/* Grouped info list */}
      <dl className="rounded-xl bg-muted/50 divide-y divide-border/60 text-sm">
        <InfoRow label="Date">
          {date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
          {time && <span className="text-muted-foreground"> · {time}</span>}
        </InfoRow>
        {authorized && (
          <InfoRow label="Authorized">
            {authorized.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </InfoRow>
        )}
        <InfoRow label="Account">{accountLabel(tx)}</InfoRow>
        {paymentChannelLabel(details) && <InfoRow label="Payment">{paymentChannelLabel(details)}</InfoRow>}
        {fullAddress(details) && (
          <InfoRow label="Location">
            <span className="whitespace-pre-line">{fullAddress(details)}</span>
          </InfoRow>
        )}
        {(plaidCategoryPath(details) || tx.category_detailed) && (
          <InfoRow label="Bank category">{plaidCategoryPath(details) || tx.category_detailed}</InfoRow>
        )}
        {counterparties.length > 0 && (
          <InfoRow label={counterparties.length === 1 ? "Via" : "Parties"}>
            {counterparties.map(c => c.name).join(", ")}
          </InfoRow>
        )}
        {details?.check_number && <InfoRow label="Check #">{details.check_number}</InfoRow>}
        {bankDescription && (
          <InfoRow label="Statement">
            <span className="font-mono text-xs break-all">{bankDescription}</span>
          </InfoRow>
        )}
        {website && (
          <InfoRow label="Website">
            <a
              href={website.startsWith("http") ? website : `https://${website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600"
            >
              {website.replace(/^https?:\/\/(www\.)?/, "")}
              <ExternalLink className="h-3 w-3" />
            </a>
          </InfoRow>
        )}
      </dl>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant={tx.recurring ? "default" : "outline"}
          onClick={() => onToggleRecurring(tx)}
          className="flex-1"
        >
          <Repeat className="mr-2 h-4 w-4" />
          {tx.recurring ? "Recurring" : "Mark Recurring"}
        </Button>
        <Button
          variant={tx.hidden ? "default" : "outline"}
          onClick={() => onToggleHidden(tx)}
          className="flex-1"
        >
          {tx.hidden ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
          {tx.hidden ? "Unhide" : "Hide"}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-destructive" aria-label="Delete transaction">
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
                onClick={() => onDelete(tx)}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <dt className="text-muted-foreground flex-shrink-0">{label}</dt>
      <dd className="text-right min-w-0">{children}</dd>
    </div>
  )
}
