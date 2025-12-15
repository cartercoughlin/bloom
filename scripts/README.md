# Database Scripts

This directory contains SQL scripts for database migrations and fixes.

## Recent Fixes

### 014_fix_new_transactions.sql (RECOMMENDED - Use This One)

**Purpose:** Selectively fixes transaction types based on when they were created.

**Background:**
The Plaid sync had reversed transaction logic before commit `da6c23f0` (2025-12-14 22:39:17 UTC):
- Positive amounts (expenses) were marked as `credit` (should be `debit`)
- Negative amounts (income) were marked as `debit` (should be `credit`)

Script 013 swapped ALL transactions, but that incorrectly reversed transactions that were synced AFTER the code fix (which already had correct types).

**When to run:**
- If you ran script 013 and now recent transactions (Dec 12-13) are backwards
- If you need to fix all transactions in one go with the correct logic

**How to run:**
1. Open your Supabase SQL Editor
2. Copy and paste the contents of `014_fix_new_transactions.sql`
3. Execute the script
4. Review the before/after breakdown

**What it does:**
- Swaps ONLY transactions created AFTER the code fix (2025-12-14 22:39:17 UTC)
- Leaves old transactions (already swapped) as-is
- Shows detailed breakdown by creation time

---

### 013_fix_transaction_types.sql (DEPRECATED)

**⚠️ WARNING:** This script swaps ALL transactions indiscriminately. Use script 014 instead.

**Purpose:** Initial attempt to fix reversed transaction types.

**Problem:** This swaps all transactions, including ones that were synced after the code fix and already had correct types.

**Do NOT use this script.** Use `014_fix_new_transactions.sql` instead.
