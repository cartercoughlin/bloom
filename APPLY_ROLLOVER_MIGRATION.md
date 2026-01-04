# Apply Rollover Toggle Migration

The per-budget rollover toggle feature requires a database migration to add the `enable_rollover` column to the budgets table.

## Quick Fix - Apply Migration Manually

1. **Go to your Supabase Dashboard**: https://app.supabase.com
2. **Open your project**
3. **Navigate to SQL Editor** (in the left sidebar)
4. **Paste and run this SQL**:

```sql
-- Add enable_rollover column to budgets table
ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS enable_rollover BOOLEAN DEFAULT true;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_budgets_enable_rollover ON public.budgets(enable_rollover);
```

5. **Click "Run"**

That's it! The rollover toggle feature will now work.

## Alternative: Use Supabase CLI

If you have the Supabase CLI installed:

```bash
supabase db push --file migrations/add-budget-rollover-toggle.sql
```

## What This Does

- Adds an `enable_rollover` column to each budget (default: `true`)
- Allows you to toggle rollover on/off per budget category
- Enables both positive and negative rollover amounts
- Creates an index for better query performance

## After Migration

Once applied:
1. Refresh your app
2. Edit any budget
3. You'll see the "Enable Rollover" toggle
4. Turn it off to prevent that budget category from rolling over to next month
