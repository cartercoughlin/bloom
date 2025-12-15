# Budget App

A Next.js-based budget tracking application that allows users to connect their bank accounts, import transactions, and analyze their financial data. **Optimized for mobile** with native app capabilities via Capacitor.

## Features

- **Bank Account Integration via Plaid**
  - Secure connection to 11,000+ financial institutions
  - Automatic transaction import and categorization
  - Real-time account balance syncing
  - Support for checking, savings, credit cards, and investment accounts
- Transaction management and categorization
- Smart category suggestions and rules
- Transaction filtering and search
- Category creation and customization
- Real-time transaction categorization
- Budget tracking with intelligent expected spending indicators
  - **Recurring transaction support** for rent, utilities, subscriptions
  - Smart progress bars that distinguish recurring vs variable expenses
  - Visual markers showing expected spending accounting for payment timing
  - Prevents false "over budget" alerts when recurring expenses hit early
  - Helps identify if you're spending too fast or staying on track
- **Mobile-First Design & Native App Support**
  - Native iOS and Android app via Capacitor
  - Client-side rendering for optimal mobile performance
  - Offline data caching with Capacitor Storage
  - Native haptic feedback for interactions
  - Smart keyboard handling with auto-scroll
  - Safe area support for iOS notch and home indicator
  - Touch-optimized UI with proper tap targets
- **Progressive Web App (PWA) Support**
  - Install as a web app on iOS and Android
  - Offline functionality with service worker
  - App-like experience with standalone display mode
  - Home screen icon and splash screen

## Tech Stack

- Next.js 16 (App Router)
- React 19
- Capacitor 8 (Native mobile platform)
- Supabase (Authentication & Database)
- TypeScript
- Tailwind CSS 4
- shadcn/ui components

## Recent Changes

### Recurring Transaction Tracking (2025-12-15)

**Smart Budget Trending with Recurring Expenses**

Traditional budget progress bars assume expenses are evenly distributed throughout the month. However, large recurring expenses like rent and utilities often hit at the beginning of the month, making it appear you're "over budget" when you're actually on track. This feature solves that problem.

**How It Works:**

When you mark a transaction as recurring (rent, mortgage, utilities, subscriptions), the budget system treats it differently:

- **Recurring expenses** are counted as "expected" immediately from day 1 of the month
- **Variable expenses** continue to scale evenly through the month
- The blue "expected spending" line on progress bars adjusts to show: `expected = recurring expenses + (variable expenses × % through month)`

**Example:**
Let's say you have a $1,500 monthly budget:
- $1,000 rent (marked as recurring, paid on day 1)
- $500 in groceries and other variable expenses

Without recurring tracking:
- Day 1: You've spent $1,000 of $50 expected (1,900% over budget! 😱)
- Day 15: You've spent $1,200 of $750 expected (160% over budget 😰)

With recurring tracking:
- Day 1: You've spent $1,000 of $1,016 expected (98% - on track! ✅)
- Day 15: You've spent $1,200 of $1,250 expected (96% - on track! ✅)

**Features:**
- Mark any transaction as recurring with the Repeat icon button
- Recurring transactions show a badge in the transactions table
- Progress bars automatically calculate smarter expected spending
- Tooltips show breakdown: "Expected: $1,250 ($1,000 recurring + $250 variable)"
- Works seamlessly with income offsets within categories

**Technical Implementation:**
- Added `recurring` boolean column to transactions table
- Separate tracking of `recurringExpenses` vs `variableExpenses` per category
- Smart expected spending formula in budget progress calculations
- API endpoint: `PUT /api/transactions/[id]/recurring`

**Files Modified:**
- `scripts/017_add_recurring_to_transactions.sql` - Database migration
- `components/transactions-table.tsx` - UI toggle and display
- `app/api/transactions/[id]/recurring/route.ts` - API endpoint
- `app/(app)/budgets/page.tsx` - Data fetching and calculation
- `components/budget-list.tsx` - Progress bar logic
- `components/budget-overview.tsx` - Interface updates

**Migration Required:**
Run `scripts/017_add_recurring_to_transactions.sql` in Supabase to add the recurring column.

### Mobile Optimizations (2025-12-13)

**Capacitor Integration for Native Mobile Apps**
- Installed and configured Capacitor for iOS and Android
- Added native platform detection utilities
- Configured app for native iOS and Android builds
- Set up proper keyboard and status bar handling

**Client-Side Rendering for Heavy Pages**
- Converted dashboard and transactions pages to client components
- Disabled SSR/streaming for better mobile performance
- Implemented client-side data fetching with loading states
- Added intelligent data caching with Capacitor Storage
- Pages now load instantly from cache while fetching fresh data

**Safe Area Support**
- Added CSS variables for safe area insets (iOS notch, status bar, home indicator)
- Configured viewport with `viewport-fit=cover` for full-screen support
- Created utility classes: `.safe-top`, `.safe-bottom`, `.safe-area`, `.h-screen-safe`
- Added mobile viewport optimizations (tap highlight, touch action)

**Capacitor Storage API Integration**
- Created comprehensive storage utilities replacing localStorage
- Implemented offline data caching for dashboard and transactions
- Added cache management utilities for JSON data
- Automatic fallback to localStorage for web platform

**Native Haptic Feedback**
- Integrated Capacitor Haptics API
- Added haptic feedback to all buttons (light for normal, warning for destructive)
- Created `useHaptics` hook for easy integration
- Support for impact feedback (light, medium, heavy) and notifications (success, warning, error)

**Keyboard Handling**
- Created `useKeyboard` hook for mobile keyboard interactions
- Auto-scroll focused inputs into view when keyboard appears
- Keyboard show/hide event listeners
- Smart offset calculation to prevent input being hidden by keyboard

**Files Created:**
- `lib/capacitor.ts` - Platform detection and Capacitor utilities
- `hooks/use-keyboard.ts` - Keyboard handling hook
- `hooks/use-haptics.ts` - Haptic feedback hook
- `capacitor.config.ts` - Capacitor configuration

**Files Modified:**
- `app/(app)/dashboard/page.tsx` - Converted to client component with caching
- `app/(app)/transactions/page.tsx` - Converted to client component with caching
- `components/ui/button.tsx` - Added haptic feedback
- `styles/globals.css` - Added safe area variables and mobile utilities
- `app/layout.tsx` - Added viewport-fit for safe areas
- `package.json` - Added Capacitor scripts and dependencies
- `next.config.mjs` - Optimized for mobile builds

**New NPM Scripts:**
- `npm run build:mobile` - Build app and sync to native platforms
- `npm run dev:ios` - Build and open iOS project in Xcode
- `npm run dev:android` - Build and open Android project in Android Studio
- `npm run cap:sync` - Sync web assets to native platforms
- `npm run cap:open:ios` - Open iOS project in Xcode
- `npm run cap:open:android` - Open Android project in Android Studio

### New Features

**2025-12-12: Mobile bottom navigation bar**
- Added fixed bottom navigation bar for mobile devices
- Navigation stays in place while scrolling
- Quick access to Dashboard, Transactions, Budgets, and Categories
- Only visible on mobile devices (hidden on desktop)
- Files created:
  - `components/mobile-nav.tsx`
- Files modified:
  - `app/(app)/layout.tsx`

**2025-12-12: Fixed inconsistent page widths**
- Standardized all pages to use `max-w-7xl` for consistent layout width
- Added bottom padding (`pb-20`) on mobile to prevent content from being hidden by bottom nav
- Files modified:
  - `app/(app)/dashboard/page.tsx`
  - `app/(app)/transactions/page.tsx`
  - `app/(app)/budgets/page.tsx`
  - `app/(app)/categories/page.tsx`

**2025-12-12: Additional mobile component optimizations**
- Optimized Top Expenses component for mobile with smaller text and spacing
- Optimized Monthly Trend chart for mobile with reduced height and smaller text
- Files modified:
  - `components/top-transactions.tsx`
  - `components/monthly-trend.tsx`

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
   npm install --legacy-peer-deps
   ```

2. Set up your Supabase project and configure environment variables

3. **Configure Plaid Integration**
   - Sign up for a Plaid account at [https://plaid.com](https://plaid.com)
   - Get your Client ID and Secret from the Plaid Dashboard
   - Set environment variables in Vercel or your deployment platform:
     - `PLAID_CLIENT_ID` - Your Plaid Client ID
     - `PLAID_SECRET` - Your Plaid Secret (use production secret for production)
     - `PLAID_ENV` - Environment (sandbox/development/production)
     - `NEXT_PUBLIC_PLAID_ENV` - Public environment variable

4. **Run database migrations** (execute SQL files in order in your Supabase SQL editor):
   - `scripts/001_create_tables.sql` - Create base tables
   - `scripts/002_seed_default_categories.sql` - Add default categories
   - `scripts/003_add_sync_columns.sql` - Add sync columns
   - `scripts/004_create_category_rules.sql` - Create category rules table
   - `scripts/005_add_hidden_to_transactions.sql` - Add hidden column to transactions
   - `scripts/006_create_plaid_items.sql` - Create Plaid items table
   - `scripts/017_add_recurring_to_transactions.sql` - Add recurring column for smart budget trending

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

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

## Native Mobile App Development (Capacitor)

### Building the Native App

The app uses Capacitor to create native iOS and Android applications with full access to native device features.

#### Prerequisites

**For iOS Development:**
- macOS with Xcode 14+ installed
- iOS Simulator or physical iOS device
- Apple Developer account (for device testing/deployment)

**For Android Development:**
- Android Studio installed
- Android SDK and emulator configured
- Java Development Kit (JDK) 17+

#### Build Process

1. **Build the Next.js app:**
   ```bash
   npm run build
   ```

2. **Sync web assets to native platforms:**
   ```bash
   npm run cap:sync
   ```

3. **Open native IDE:**
   ```bash
   # For iOS
   npm run cap:open:ios

   # For Android
   npm run cap:open:android
   ```

4. **Build and run from IDE:**
   - **iOS**: Click the Play button in Xcode to run on simulator or device
   - **Android**: Click Run in Android Studio to launch on emulator or device

#### Quick Development Workflow

Use the convenience scripts for faster iteration:

```bash
# Build and open iOS project
npm run dev:ios

# Build and open Android project
npm run dev:android
```

### Mobile-Specific Features

#### Capacitor Storage API
- Replace `localStorage` calls with the storage utilities from `lib/capacitor.ts`
- Automatically uses Capacitor Preferences on native, falls back to localStorage on web
- JSON caching utilities for complex data structures

```typescript
import { storage, cache } from '@/lib/capacitor'

// Simple storage
await storage.set('key', 'value')
const value = await storage.get('key')

// JSON caching
await cache.setJSON('user', { name: 'John', age: 30 })
const user = await cache.getJSON('user')
```

#### Haptic Feedback
- All buttons automatically trigger haptic feedback
- Use the `useHaptics` hook for custom interactions

```typescript
import { useHaptics } from '@/hooks/use-haptics'

const haptics = useHaptics()

// Light tap
haptics.light()

// Success notification
haptics.success()

// Error notification
haptics.error()
```

#### Keyboard Handling
- Use the `useKeyboard` hook for smart keyboard management
- Automatically scrolls inputs into view when keyboard appears

```typescript
import { useKeyboard } from '@/hooks/use-keyboard'

const { isKeyboardVisible, hideKeyboard } = useKeyboard({
  autoScroll: true,
  scrollOffset: 20,
  onKeyboardShow: () => console.log('Keyboard opened'),
  onKeyboardHide: () => console.log('Keyboard closed')
})
```

#### Safe Area Support
- Use CSS utility classes for safe area padding:
  - `.safe-top` - Add padding for status bar/notch
  - `.safe-bottom` - Add padding for home indicator
  - `.safe-area` - Add padding on all sides
  - `.h-screen-safe` - Full height minus safe areas

```tsx
<div className="safe-top">
  Content that respects iOS notch
</div>
```

#### Platform Detection
```typescript
import { isNativePlatform, isIOS, isAndroid, isWeb } from '@/lib/capacitor'

if (isNativePlatform()) {
  // Native-specific code
}

if (isIOS()) {
  // iOS-specific code
}
```

### Performance Optimizations

#### Client-Side Rendering
- Heavy pages (dashboard, transactions) use client-side data fetching
- Data is cached in Capacitor Storage for instant loads
- Fresh data is fetched in background while showing cached data

#### Offline Support
- Service worker caches static assets
- Capacitor Storage caches dynamic data
- App works offline with last loaded data

#### Mobile-Specific Optimizations
- Disabled tap highlight for cleaner UI
- Touch action optimizations for smooth scrolling
- 44px minimum tap targets for accessibility
- Responsive breakpoint at 768px (md:)

### Troubleshooting

**Bundle Identifier Issues (iOS):**
If you see an error like "The app identifier 'com.budgetapp.app' cannot be registered":
1. Open `capacitor.config.ts`
2. Change the `appId` to a unique identifier:
   ```typescript
   appId: 'com.yourname.budgetapp', // Use your own unique ID
   ```
3. Run `npm run cap:sync` to update the native projects
4. Open Xcode and update the Bundle Identifier in the project settings

**iOS Build Issues:**
- Ensure Xcode is updated to latest version
- Run `pod install` in `ios/App` directory if pods are out of date
- Clean build folder: Product → Clean Build Folder
- Change Bundle Identifier to a unique string in Xcode project settings
- Ensure you're signed in with an Apple Developer account in Xcode

**Android Build Issues:**
- Check SDK is installed via Android Studio SDK Manager
- Ensure JAVA_HOME is set correctly
- Sync Gradle files in Android Studio
- Change `applicationId` in `android/app/build.gradle` if needed

**Data not persisting:**
- Check Capacitor Storage permissions in native settings
- Verify `await` is used with all storage operations
- Check browser console for errors on web platform

## Project Structure

- `/app` - Next.js app router pages and API routes
- `/components` - React components (UI and feature components)
- `/lib` - Utility functions and configurations
  - `/lib/capacitor.ts` - Mobile platform utilities
- `/hooks` - React hooks
  - `/hooks/use-keyboard.ts` - Keyboard handling
  - `/hooks/use-haptics.ts` - Haptic feedback
- `/ios` - iOS native project (generated by Capacitor)
- `/android` - Android native project (generated by Capacitor)

# npm run deploy-mobile
