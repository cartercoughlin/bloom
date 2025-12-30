# Force Sync Connected Accounts

If your newly connected account isn't showing up, you can force a manual sync.

## Option 1: Browser Console (Easiest)

1. Open the PWA/website
2. Open browser dev tools (F12 or Right-click → Inspect)
3. Go to the Console tab
4. Paste this code and press Enter:

```javascript
fetch('/api/sync-transactions', { method: 'POST' })
  .then(r => r.json())
  .then(data => console.log('✅ Sync result:', data))
  .catch(err => console.error('❌ Sync error:', err))
```

## Option 2: Check Database (Diagnose)

Run the diagnostic SQL to see if the account is stored:

```bash
psql $DATABASE_URL -f force-sync.sql
```

## Option 3: Command Line Sync

If you have the environment set up, run:

```bash
node force-sync.js
```

## Option 4: Use the Sync Button

Go to the Connected Accounts section and click the "Sync Transactions" button.

## What to Check

After syncing, check the browser console for:
- Any error messages
- Sync results showing transactions processed
- Whether `sync_transactions` and `sync_balances` are true

## Common Issues

1. **Account stored but not visible**
   - The connected-accounts API might be failing to fetch account details from Plaid
   - Check browser console for errors

2. **No transactions after sync**
   - Check if transactions exist in the last 2 years
   - Plaid only syncs recent transactions

3. **API rate limiting**
   - If you've synced many times, wait a few minutes
