// Shared types and formatting for showing transactions in the UI.

// Extra Plaid data stored by lib/plaid-sync.ts (buildPlaidDetails)
export interface PlaidDetails {
  pending?: boolean
  payment_channel?: "online" | "in store" | "other" | null
  authorized_date?: string | null
  datetime?: string | null
  location?: {
    address?: string | null
    city?: string | null
    region?: string | null
    postal_code?: string | null
    store_number?: string | null
  } | null
  category_primary?: string | null
  category_detailed?: string | null
  category_confidence?: string | null
  category_icon_url?: string | null
  counterparties?: { name: string; type: string; logo_url?: string | null; website?: string | null }[]
  check_number?: string | null
  account_owner?: string | null
  iso_currency_code?: string | null
  original_name?: string | null
}

export interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  transaction_type: "credit" | "debit"
  bank: string
  category_id?: string | null
  hidden?: boolean
  recurring?: boolean
  merchant_name?: string | null
  logo_url?: string | null
  website?: string | null
  category_detailed?: string | null
  plaid_account_id?: string | null
  account_name?: string | null
  plaid_details?: PlaidDetails | null
  tag_ids?: string[]
  categories?: {
    name: string
    color: string
    icon?: string
  } | null
}

export interface Category {
  id: string
  name: string
  color: string
  icon?: string
}

// Dates are stored as YYYY-MM-DD; `new Date("2024-03-05")` parses as UTC
// midnight, which shows as the previous day in US timezones.
export function parseLocalDate(date: string): Date {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number)
  return new Date(year, month - 1, day)
}

export function displayName(tx: Transaction): string {
  return tx.merchant_name || tx.plaid_details?.counterparties?.[0]?.name || tx.description
}

export function logoFor(tx: Transaction): string | null {
  return tx.logo_url || tx.plaid_details?.counterparties?.find(c => c.logo_url)?.logo_url || null
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()).replace(/\bAnd\b/g, "and")

// "FOOD_AND_DRINK_COFFEE" (primary "FOOD_AND_DRINK") -> "Coffee"
export function plaidCategoryLabel(details?: PlaidDetails | null): string | null {
  if (!details?.category_detailed) return details?.category_primary ? titleCase(details.category_primary) : null
  const primary = details.category_primary || ""
  const detailed = details.category_detailed.startsWith(primary + "_")
    ? details.category_detailed.slice(primary.length + 1)
    : details.category_detailed
  return titleCase(detailed)
}

export function plaidCategoryPath(details?: PlaidDetails | null): string | null {
  const detailed = plaidCategoryLabel(details)
  if (!details?.category_primary || !detailed) return detailed
  const primary = titleCase(details.category_primary)
  return primary === detailed ? primary : `${primary} › ${detailed}`
}

export function locationLabel(details?: PlaidDetails | null): string | null {
  const loc = details?.location
  if (!loc) return null
  return [loc.city, loc.region].filter(Boolean).join(", ") || null
}

export function fullAddress(details?: PlaidDetails | null): string | null {
  const loc = details?.location
  if (!loc) return null
  const cityLine = [[loc.city, loc.region].filter(Boolean).join(", "), loc.postal_code].filter(Boolean).join(" ")
  return [loc.address, cityLine].filter(Boolean).join("\n") || null
}

export function paymentChannelLabel(details?: PlaidDetails | null): string | null {
  switch (details?.payment_channel) {
    case "in store": return "In store"
    case "online": return "Online"
    default: return null
  }
}

// `bank` is usually already the account's name from Plaid; prefer the
// connected account's current name when we have it
export function accountLabel(tx: Transaction): string {
  return tx.account_name || tx.bank
}
