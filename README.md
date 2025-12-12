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

## Tech Stack

- Next.js 14
- React
- Supabase (Authentication & Database)
- TypeScript
- Tailwind CSS
- shadcn/ui components

## Recent Changes

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

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

- `/app` - Next.js app router pages and API routes
- `/components` - React components (UI and feature components)
- `/lib` - Utility functions and configurations
