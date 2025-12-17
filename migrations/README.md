# Database Migrations

## How to Run Migrations

### Using Supabase Dashboard:
1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy and paste the migration SQL
5. Click "Run" to execute

### Using Supabase CLI:
```bash
supabase db execute --file migrations/fix-account-balances-constraint.sql
```

## Available Migrations

### fix-account-balances-constraint.sql
**Purpose:** Fix constraint to allow multiple Plaid accounts with the same name

**Problem:**
- Betterment has 6 investment accounts, but only 1 shows in the app
- Multiple accounts with generated names like "INVESTMENT" fail to insert
- Original UNIQUE(user_id, account_name) constraint is too restrictive

**Solution:**
- Removes UNIQUE(user_id, account_name) constraint
- Adds partial unique index on (user_id, plaid_account_id) for Plaid accounts
- Adds partial unique index on (user_id, account_name) for manual accounts only
- Allows multiple Plaid accounts with same name but different plaid_account_ids

**After running:**
1. Re-sync your accounts from the Accounts page
2. All 6 Betterment accounts should appear
3. All First Horizon accounts should appear
4. Net worth should increase from ~$84k to ~$99k
