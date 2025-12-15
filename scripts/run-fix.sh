#!/bin/bash

# Helper script to pull Vercel environment variables and run the transaction fix
#
# Usage:
#   ./scripts/run-fix.sh

set -e

echo "🔐 Pulling environment variables from Vercel..."

# Check if vercel CLI is available
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js"
    exit 1
fi

# Pull environment variables from Vercel (requires authentication)
npx vercel env pull .env.local --yes

if [ ! -f .env.local ]; then
    echo "❌ Failed to pull environment variables from Vercel"
    echo "Please run: vercel login"
    echo "Then try again"
    exit 1
fi

echo "✅ Environment variables pulled successfully"
echo ""

# Source the environment variables
export $(cat .env.local | grep -v '^#' | xargs)

# Run the fix script
echo "🚀 Running transaction type fix..."
node scripts/fix-transactions.mjs

# Clean up .env.local for security
rm .env.local
echo ""
echo "🧹 Cleaned up temporary .env.local file"
