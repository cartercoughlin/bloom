# Budget App

A Next.js-based budget tracking application that allows users to import, categorize, and analyze their financial transactions.

## Features

- Transaction import and management
- Smart category suggestions
- Transaction filtering and search
- Category creation and customization
- Real-time transaction categorization

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

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up your Supabase project and configure environment variables

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

- `/app` - Next.js app router pages and API routes
- `/components` - React components (UI and feature components)
- `/lib` - Utility functions and configurations
