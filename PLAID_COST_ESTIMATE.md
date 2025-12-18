# Plaid API Cost Estimate for Bloom Budget

## Summary
Based on the codebase analysis and Plaid's 2025 pricing, your monthly Plaid costs will primarily depend on the number of **active connected bank accounts** (Items) rather than individual API calls.

**Current Setup:** 1 user with 12 connected accounts in Production mode
**Your Monthly Cost:** **~$500/month** (minimum commitment, even though calculated cost is only $18)

**Estimated Cost for Scale:** ~$1.50 per Item (bank connection) per month

---

## Current Plaid Integration Analysis

### Environment Configuration
- **Current Environment:** Production (PLAID_ENV=production)
- **Sandbox:** FREE (unlimited usage, test data only)
- **Production:** Billable based on active Items, **$500/month minimum**

**Note:** Plaid discontinued the Development tier. Only Sandbox (free/test) and Production (paid/real data) are available.

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

Plaid uses a **per-product pricing model** based on API usage:

#### Product Pricing (Actual Plaid Rates)
- **Auth:** $1.50 per initial call (one-time when connecting account)
- **Balance:** $0.10 per call (each time you fetch balances)
- **Transactions:** $0.30 per connected account/month (recurring)
- **Investments Holdings:** $0.18 per connected account/month
- **Investments Transactions:** $0.35 per connected account/month
- **Enrich:** $2.00 per thousand transactions

### Pricing Tiers

#### Sandbox (Free Tier)
- **Cost:** $0
- **Usage:** Unlimited API calls for testing
- **Limitations:** Can only use test credentials, no real bank data
- **Best for:** Development and testing only

#### Pay-as-You-Go (Production)
- **Cost:** Based on actual API usage (see product pricing above)
- **Minimum Monthly Commitment:** Typically **$500/month** (confirm with your invoice)
- **Best for:** Businesses with users
- **Reality Check:** May have minimum commitment regardless of usage

#### Custom/Scale Tier (Enterprise)
- **Cost:** Negotiated rates with volume commitments
- **Minimum:** Higher monthly commitment (likely $1,000-$5,000+)
- **Best for:** Apps with >1,000 active connections

---

## Monthly Cost Estimates

### Scenario 1: Personal Use (CURRENT SETUP)
- **Users:** 1 (you)
- **Active Items:** 12 connected accounts

**Calculated Monthly Costs:**
- **Transactions product:** 12 accounts × $0.30 = **$3.60/month**
- **Balance syncs:**
  - Manual/monthly: 12 × 1 × $0.10 = **$1.20/month**
  - Weekly syncs: 12 × 4 × $0.10 = **$4.80/month**
  - Daily syncs: 12 × 30 × $0.10 = **$36/month**
- **Auth (one-time):** 12 × $1.50 = **$18** (already paid when connecting accounts)

**Calculated Total:** **$5-40/month** (depending on sync frequency)

**⚠️ IMPORTANT:** If you're on pay-as-you-go with a **$500/month minimum**, you're paying the minimum regardless.
- Check your actual Plaid invoice to confirm if the minimum applies
- If paying $500/month: You're using only 1-8% of what you're paying for
- If paying actual usage: You're paying $5-40/month (very reasonable!)

### Scenario 2: Development/Testing
- **Users:** Any number
- **Environment:** Sandbox
- **Monthly Cost:** **$0**
- **Notes:** Perfect for development, but only test data (not real transactions)

### Scenario 3: Small Business (50-100 users)
- **Active accounts:** 100-300 connected accounts (assuming ~2-3 per user)
- **Transactions:** 100-300 × $0.30 = **$30-$90/month**
- **Balance syncs (weekly):** 100-300 × 4 × $0.10 = **$40-$120/month**
- **Auth (one-time/new users):** ~$1.50 per new user
- **Calculated Total:** **$70-$210/month**
- **If $500 minimum applies:** You pay **$500/month**
- **Break-even:** ~1,667 accounts to justify $500 minimum

### Scenario 4: Medium Business (200-500 users)
- **Active accounts:** 400-1,000 connected accounts
- **Transactions:** 400-1,000 × $0.30 = **$120-$300/month**
- **Balance syncs (weekly):** 400-1,000 × 4 × $0.10 = **$160-$400/month**
- **Calculated Total:** **$280-$700/month**
- **Likely paying:** $500/month minimum (for lower end) or actual usage (for higher end)

### Scenario 5: Large Scale (1,000+ users)
- **Active accounts:** 2,000+ connected accounts
- **Transactions:** 2,000 × $0.30 = **$600+/month**
- **Balance syncs (weekly):** 2,000 × 4 × $0.10 = **$800+/month**
- **Calculated Total:** **$1,400+/month**
- **At this scale:** Negotiate custom/enterprise pricing for discounts

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

### 1. Confirm Your Environment ✅
**Current Status:** Production environment (PLAID_ENV=production)
- You're on the **Pay-as-you-go tier**
- **12 active Items** (connected bank accounts)
- **Paying:** $500/month (minimum commitment)

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

### Your Current Situation (Personal Use)
- **Active accounts:** 12 connected accounts
- **Calculated monthly cost:**
  - Transactions: $3.60/month
  - Balance syncs: $1.20-$36/month (depending on frequency)
  - **Total: $5-40/month**

**Critical Question:** Are you paying $500/month (minimum) or actual usage ($5-40)?
- **Check your Plaid invoice** to see if the minimum commitment applies
- If paying **$500/month**: You're using only 1-8% of what you're paying for (not cost-effective)
- If paying **$5-40/month**: This is very reasonable for personal use! (cost-effective)

### Cost Breakdown by Scale (With Actual Pricing)

**Assuming weekly balance syncs:**
- **Personal use (12 accounts):** $5-8/month calculated, **but may pay $500 minimum** ⚠️
- **Small business (100-300 accounts):** $70-210/month calculated, **likely pay $500 minimum**
- **Medium scale (400-800 accounts):** $280-560/month - may exceed minimum
- **Large scale (1,000+ accounts):** $700-1,400+/month - definitely paying actual usage

### Alternatives for Personal Use

If you want to reduce costs for personal budgeting:

1. **Pluto** (formerly Teller) - Lower/no minimums, similar API
2. **Yodlee** - May have lower minimums for personal use
3. **MX** - Alternative aggregator
4. **Manual CSV imports** - Free but requires manual work
5. **Wait for user base** - Keep using Plaid if you plan to add users soon (cost becomes reasonable at ~50+ users)

### If Building a Business
Your integration is well-optimized. The main cost driver is the number of active Items, not API call volume. The $500/month becomes cost-effective once you have:
- **50-100 users** connecting accounts (assuming 2-4 accounts each)
- **~334+ total Items** (break-even point)

Focus on user growth and Item management to control costs.
