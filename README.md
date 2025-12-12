# Budget App

A Next.js-based budget tracking application that allows users to import, categorize, and analyze their financial transactions.

## Features

- Transaction import and management
- Smart category suggestions
- Transaction filtering and search
- Category creation and customization
- Real-time transaction categorization
- Budget tracking with expected spending indicators
  - Visual markers on progress bars showing expected spending based on time through the month
  - Helps identify if you're spending too fast or staying on track
- **Progressive Web App (PWA) Support**
  - Install as a mobile app on iOS and Android
  - Offline functionality with service worker
  - App-like experience with standalone display mode
  - Home screen icon and splash screen

## Tech Stack

- Next.js 14
- React
- Supabase (Authentication & Database)
- TypeScript
- Tailwind CSS
- shadcn/ui components

## Recent Changes

### New Features

**2025-12-12: Mobile layout optimization**
- Optimized all components for mobile viewing
- Dashboard spending overview cards now display in 2-column grid on mobile
- Spending chart height and sizing adjusted for smaller screens
- Transactions table with smaller text, reduced padding, and hidden bank column on mobile
- Budget components with responsive text sizes and compact spacing
- All page headers and buttons optimized for mobile
- Files modified:
  - `components/spending-overview.tsx`
  - `components/spending-by-category.tsx`
  - `components/transactions-table.tsx`
  - `components/budget-overview.tsx`
  - `components/budget-list.tsx`
  - `app/(app)/dashboard/page.tsx`
  - `app/(app)/transactions/page.tsx`
  - `app/(app)/budgets/page.tsx`

### Bug Fixes

**2025-12-12: Fixed UUID validation error in category updates**
- Fixed error "invalid input syntax for type uuid: 'undefined'" when updating transaction categories
- Added validation in both frontend and backend to handle invalid UUID strings
- Added filtering to prevent rendering transactions without valid IDs
- Files modified:
  - `components/transaction-categorizer.tsx`
  - `app/api/transactions/[id]/category/route.ts`
  - `components/transactions-table.tsx`

**2025-12-12: Fixed vercel.json schema validation error**
- Removed invalid `projectSettings` property
- Removed deprecated `alias` property
- Added valid build configuration properties

**2025-12-12: Added debugging for transaction ID issues**
- Added console logging to track transaction IDs through the component lifecycle
- Improved error messages for missing transaction IDs

**2025-12-12: Fixed async params handling in Next.js 14+ API routes**
- Updated API route to properly await `params` Promise (Next.js 14+ breaking change)
- This was causing transaction IDs to be undefined when updating categories
- File modified: `app/api/transactions/[id]/category/route.ts`

### New Features

**2025-12-12: Added expected spending indicators to budget progress bars**
- Added blue marker on progress bars showing expected spending based on percentage through the month
- Shows expected value on hover tooltip
- Only displays for current month budgets
- Helps users see if they're on track with their spending
- Files modified:
  - `components/budget-list.tsx`
  - `components/budget-overview.tsx`
  - `app/(app)/budgets/page.tsx`

**2025-12-12: Added mobile navigation menu**
- Added hamburger menu button for mobile devices
- Implemented slide-out navigation drawer using Sheet component
- Mobile menu includes all navigation items and logout button
- Menu automatically closes when navigating to a new page
- Desktop navigation remains unchanged
- File modified:
  - `components/app-nav.tsx`

**2025-12-12: Auto-refresh categories in budget dialog**
- Budget category dropdown now fetches latest categories when opened
- Categories created from transactions page immediately appear in budget dialog
- No need to refresh the page to see new categories
- File modified:
  - `components/budget-list.tsx`

**2025-12-12: Added ability to hide transactions**
- Transactions can now be hidden from the main view
- Hidden transactions don't affect budgets or spending calculations
- Toggle button to show/hide hidden transactions
- Eye icon button on each transaction to hide/unhide
- Useful for transfers, reimbursements, or test transactions
- Files created:
  - `scripts/005_add_hidden_to_transactions.sql`
  - `app/api/transactions/[id]/hidden/route.ts`
- Files modified:
  - `components/transactions-table.tsx`
  - `app/(app)/transactions/page.tsx`

**2025-12-12: Added Progressive Web App (PWA) support**
- App can now be installed as a mobile app on iOS and Android
- Created web app manifest with app metadata and icons
- Added service worker for offline functionality and caching
- Configured PWA meta tags for proper mobile display
- Added icon requirements and setup guide
- Files created:
  - `public/manifest.json`
  - `public/sw.js`
  - `app/register-sw.tsx`
  - `PWA_ICONS_SETUP.md`
- Files modified:
  - `app/layout.tsx`

**2025-12-12: Rounded numbers in spending by category chart**
- Pie chart labels now show rounded dollar amounts (no decimals)
- Labels hidden for slices < 5% to reduce clutter
- Tooltip still shows precise amounts with 2 decimals
- File modified:
  - `components/spending-by-category.tsx`

**2025-12-12: Implemented category rules system with advanced conditions**
- Created category_rules database table with full schema
- Rules now support multiple condition types that can be combined
- Available conditions: description, amount range, transaction type, bank, account, institution
- All conditions use regex patterns for flexible matching
- Added PUT and DELETE API endpoints for editing and deleting rules
- Completely rebuilt rule form with all condition fields
- Updated rule matching logic to check all specified conditions
- Rules are checked in priority order (highest first)
- Fixed Select component empty value error
- Added "Clear filter" button for transaction type selection
- Files modified/created:
  - `scripts/004_create_category_rules.sql` (NEW)
  - `lib/category-rules.ts`
  - `app/api/category-rules/route.ts`
  - `app/api/category-rules/[id]/route.ts` (NEW)
  - `components/category-rule-form.tsx`

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up your Supabase project and configure environment variables

3. **Run database migrations** (execute SQL files in order in your Supabase SQL editor):
   - `scripts/001_create_tables.sql` - Create base tables
   - `scripts/002_seed_default_categories.sql` - Add default categories
   - `scripts/003_add_sync_columns.sql` - Add sync columns
   - `scripts/004_create_category_rules.sql` - Create category rules table
   - `scripts/005_add_hidden_to_transactions.sql` - Add hidden column to transactions

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## PWA Setup (Optional - for Mobile App Installation)

To enable "Add to Home Screen" functionality and install the app as a mobile app:

1. **Generate PWA Icons** (required)
   - See detailed instructions in `PWA_ICONS_SETUP.md`
   - Quick option: Use [PWA Builder Image Generator](https://www.pwabuilder.com/imageGenerator)
   - Place generated icons in `/public` directory:
     - `icon-192.png` (192x192)
     - `icon-512.png` (512x512)
     - `apple-icon.png` (180x180)
     - `icon-light-32x32.png` and `icon-dark-32x32.png` (32x32)

2. **Deploy to Vercel** (PWA requires HTTPS)
   ```bash
   vercel deploy
   ```

3. **Install on Mobile**
   - **iOS**: Safari → Share → Add to Home Screen
   - **Android**: Chrome → Menu → Install App
   - **Desktop**: Chrome → Address bar → Install icon

### PWA Features
- ✅ Offline support with service worker caching
- ✅ App-like experience (no browser UI)
- ✅ Home screen icon
- ✅ Faster loading with cached resources
- ✅ Works on iOS, Android, and desktop

## Project Structure

- `/app` - Next.js app router pages and API routes
- `/components` - React components (UI and feature components)
- `/lib` - Utility functions and configurations
