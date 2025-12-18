# Plaid API Cost Estimate for Bloom Budget

## Summary
Based on the codebase analysis and Plaid's 2025 pricing, your monthly Plaid costs will primarily depend on the number of **active connected bank accounts** (Items) rather than individual API calls.

**Estimated Cost:** ~$1.50 per active user per month (for users with connected accounts)

---

## Current Plaid Integration Analysis

### Environment Configuration
- **Current Environment:** Configurable via `PLAID_ENV` (sandbox/development/production)
- **Development/Sandbox:** FREE (unlimited usage)
- **Production:** Billable based on active Items

### API Calls Identified

#### 1. **Link Token Create** (`/api/plaid/link-token`)
- **Frequency:** Once per connection attempt
- **When:** User clicks to connect a new bank account
- **Cost Impact:** Not directly billable; part of the linking flow

#### 2. **Item Public Token Exchange** (`/api/plaid/exchange-token`)
- **Frequency:** Once per successful account connection
- **API Calls per connection:**
  - `itemPublicTokenExchange()` - Exchange public token for access token
  - `accountsGet()` - Get account details
  - `institutionsGetById()` - Get institution name
- **Cost Impact:** Creates a billable "Item" in production

#### 3. **Transaction Sync** (`/api/sync-transactions`)
- **Frequency:** User-triggered or automated (appears to be manual in your app)
- **API Calls per sync:**
  - `accountsGet()` - Get current account info
  - `institutionsGetById()` - Get institution details
  - `transactionsGet()` - Fetch last 30 days of transactions
- **Cost Impact:** Included in monthly Item cost

#### 4. **Balance Sync** (`/api/sync-balances`)
- **Frequency:** User-triggered or automated
- **API Calls per sync:**
  - `accountsGet()` - Get account balances
- **Cost Impact:** Included in monthly Item cost

---

## Plaid Pricing Model (2025)

### How Plaid Charges

Plaid uses an **Item-based pricing model** for the Transactions product:
- An "Item" = one institution connection (e.g., one Chase bank connection)
- If a user connects 3 different banks, that's 3 Items

### Pricing Tiers

#### Free Tier (Development/Sandbox)
- **Cost:** $0
- **Usage:** Unlimited API calls for testing
- **Limitations:** Can only use test credentials, no real bank data

#### Pay-as-You-Go (Production)
- **Estimated Cost:** ~$1.50 per Item per month
- **Minimum:** Typically starts at $500/month for up to 1,000 active users
- **Best for:** Small to medium apps with <1,000 active connections

#### Custom/Scale Tier
- **Cost:** Lower per-Item rates with volume commitments
- **Minimum:** Higher monthly commitment (likely $1,000-$5,000+)
- **Best for:** Apps with >1,000 active connections

---

## Monthly Cost Estimates

### Scenario 1: Development/Testing
- **Users:** Any number
- **Environment:** Sandbox
- **Monthly Cost:** **$0**
- **Notes:** Perfect for development, no real bank connections

### Scenario 2: Small User Base (10-100 connected accounts)
- **Active Items:** 10-100
- **Estimated Cost:** **$15-$150/month**
- **Calculation:** 10-100 Items × $1.50/Item
- **Notes:** May need to meet $500/month minimum, so actual cost could be **$500/month**

### Scenario 3: Medium User Base (100-500 connected accounts)
- **Active Items:** 100-500
- **Estimated Cost:** **$150-$750/month**
- **Calculation:** 100-500 Items × $1.50/Item
- **Notes:** Falls within typical pay-as-you-go range

### Scenario 4: Large User Base (1,000+ connected accounts)
- **Active Items:** 1,000+
- **Estimated Cost:** **$1,500+/month** (pay-as-you-go)
- **Custom Tier:** Likely **$1.00-$1.20 per Item** with volume discounts
- **Notes:** Should negotiate custom pricing

---

## API Call Frequency Analysis

Based on your code, here's what happens during typical usage:

### Initial Account Connection
1. User clicks "Connect Bank Account"
2. `linkTokenCreate` - Free
3. User completes Plaid Link flow - Free
4. `itemPublicTokenExchange` - Creates billable Item
5. `accountsGet` - Included
6. `institutionsGetById` - Included

**Result:** 1 new billable Item added

### Each Transaction Sync
Per connected account:
- `accountsGet` - 1 call
- `institutionsGetById` - 1 call
- `transactionsGet` - 1 call (fetches 30 days)

**API Calls:** 3 calls per Item per sync
**Cost:** Included in monthly Item fee (no per-call charges)

### Each Balance Sync
Per connected account:
- `accountsGet` - 1 call

**API Calls:** 1 call per Item per sync
**Cost:** Included in monthly Item fee

---

## Cost Optimization Recommendations

### 1. **Use Sandbox for Development**
Your code already supports this via `PLAID_ENV=sandbox`
- Keep all development/testing in sandbox
- Only use production for real users

### 2. **Implement Item Cleanup**
- Track inactive/disconnected accounts
- Your code already has cleanup logic in `/api/sync-transactions`
- Regularly remove old Items to avoid paying for inactive accounts

### 3. **Monitor Sync Frequency**
Your current implementation:
- ✅ User-triggered syncs (good - user controls frequency)
- ✅ Configurable `sync_transactions` and `sync_balances` per Item
- Consider: Set reasonable sync limits if you add automated syncing

### 4. **Track Active vs Inactive Items**
- You're charged per **active** Item (institution connection)
- Encourage users to disconnect unused accounts
- Implement a monthly cleanup job to remove stale connections

### 5. **Consider Batch Timing**
If you implement automated syncing:
- Don't sync all users simultaneously
- Spread syncs throughout the day
- This doesn't reduce costs but improves API reliability

---

## Current Implementation Strengths

✅ **Configurable sync options** - Users can enable/disable transaction and balance sync per account
✅ **Cleanup logic** - Automatically removes transactions/balances for disconnected accounts
✅ **Efficient deduplication** - Prevents duplicate transactions, reducing data storage
✅ **30-day transaction window** - Reasonable lookback period, not excessive
✅ **Sandbox support** - Can test without incurring costs

---

## Questions to Determine Exact Costs

To get precise pricing from Plaid, you'll need:

1. **Expected user count** - How many users will you have?
2. **Connection rate** - What % of users will connect bank accounts?
3. **Average accounts per user** - Will users connect 1 or multiple banks?
4. **Growth projections** - Expected user growth over 12 months?

### Example Calculation
- 1,000 total users
- 30% connect bank accounts = 300 active users
- Average 1.2 accounts per user = 360 Items
- **Estimated cost:** 360 × $1.50 = **$540/month**

---

## Next Steps

### 1. Confirm Your Environment
```bash
# Check which environment you're using
grep PLAID_ENV .env
```

If `PLAID_ENV=sandbox` or `PLAID_ENV=development` → You're paying **$0**
If `PLAID_ENV=production` → You're on billable plan

### 2. Check Current Usage
Contact Plaid or check your Plaid Dashboard to see:
- Number of active Items
- Current monthly charges
- Your pricing tier

### 3. Consider Your Scale
- **<100 Items:** Stay on pay-as-you-go, expect **$500/month minimum**
- **100-1,000 Items:** Pay-as-you-go at **~$1.50/Item**
- **>1,000 Items:** Negotiate custom pricing for **~$1.00-$1.20/Item**

---

## Additional Costs to Consider

### Beyond Plaid API
1. **Supabase hosting** - For storing transactions and account data
2. **Vercel hosting** - For your Next.js app
3. **Data storage** - Grows with transaction history
4. **Potential webhook costs** - If you implement real-time updates (not in current code)

### Plaid Product Add-ons (Not Currently Used)
- Identity Verification - Extra cost per verification
- Assets - Extra cost per asset report
- Income Verification - Extra cost per report
- Liabilities - Usually included with Transactions

---

## References & Sources

- [Account - Pricing and billing | Plaid Docs](https://plaid.com/docs/account/billing/)
- [Plaid API Pricing and Cost Analysis For FinTech Apps](https://www.fintegrationfs.com/post/plaid-pricing-and-plaid-pricing-calculator-for-fintech-apps)
- [Plaid vs Yodlee: How Much Will Financial Data APIs Cost Your Fintech?](https://www.getmonetizely.com/articles/plaid-vs-yodlee-how-much-will-financial-data-apis-cost-your-fintech)
- [Pricing - United States & Canada | Plaid](https://plaid.com/pricing/)

---

## Conclusion

**For most small-to-medium budget apps:**
- **Development:** $0 (use sandbox)
- **Production (100-500 users):** $500-$750/month
- **At scale (1,000+ users):** $1,000-$1,500+/month

Your integration is well-optimized. The main cost driver will be the number of active bank connections (Items), not API call volume. Focus on user growth and Item management to control costs.
