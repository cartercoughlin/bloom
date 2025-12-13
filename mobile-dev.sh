#!/bin/bash

# Mobile Development Helper Script for Budget App

echo "🚀 Budget App Mobile Development Helper"
echo "======================================"

# Check if we're in the right directory
if [ ! -f "capacitor.config.ts" ]; then
    echo "❌ Error: capacitor.config.ts not found. Please run this script from the project root."
    exit 1
fi

# Function to show menu
show_menu() {
    echo ""
    echo "Choose an option:"
    echo "1) Start local development (Next.js + iOS)"
    echo "2) Start local development (Next.js + Android)"
    echo "3) Sync Capacitor platforms"
    echo "4) Open iOS project in Xcode"
    echo "5) Open Android project in Android Studio"
    echo "6) Configure for production deployment"
    echo "7) Test mobile features (open browser)"
    echo "8) Show mobile development status"
    echo "9) Exit"
    echo ""
}

# Function to check prerequisites
check_prerequisites() {
    echo "🔍 Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js not found. Please install Node.js first."
        return 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        echo "❌ npm not found. Please install npm first."
        return 1
    fi
    
    # Check if dependencies are installed
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing dependencies..."
        npm install
    fi
    
    echo "✅ Prerequisites check passed!"
    return 0
}

# Function to start local development with iOS
start_dev_ios() {
    echo "📱 Starting local development with iOS..."
    echo "This will:"
    echo "1. Start Next.js dev server on port 3000"
    echo "2. Sync Capacitor platforms"
    echo "3. Open iOS project in Xcode"
    echo ""
    
    # Start Next.js in background
    echo "Starting Next.js dev server..."
    npm run dev:mobile &
    NEXTJS_PID=$!
    
    # Wait a moment for server to start
    sleep 3
    
    # Sync and open iOS
    echo "Syncing Capacitor and opening iOS project..."
    npm run cap:sync
    npm run mobile:dev:ios
    
    echo "✅ iOS development environment ready!"
    echo "📝 Next.js server PID: $NEXTJS_PID (kill with: kill $NEXTJS_PID)"
}

# Function to start local development with Android
start_dev_android() {
    echo "🤖 Starting local development with Android..."
    echo "This will:"
    echo "1. Start Next.js dev server on port 3000"
    echo "2. Sync Capacitor platforms"
    echo "3. Open Android project in Android Studio"
    echo ""
    
    # Start Next.js in background
    echo "Starting Next.js dev server..."
    npm run dev:mobile &
    NEXTJS_PID=$!
    
    # Wait a moment for server to start
    sleep 3
    
    # Sync and open Android
    echo "Syncing Capacitor and opening Android project..."
    npm run cap:sync
    npm run mobile:dev:android
    
    echo "✅ Android development environment ready!"
    echo "📝 Next.js server PID: $NEXTJS_PID (kill with: kill $NEXTJS_PID)"
}

# Function to show development status
show_status() {
    echo "📊 Mobile Development Status"
    echo "=========================="
    
    # Check if Next.js is running
    if lsof -i :3000 &> /dev/null; then
        echo "✅ Next.js dev server: Running on port 3000"
    else
        echo "❌ Next.js dev server: Not running"
    fi
    
    # Check Capacitor config
    if grep -q "localhost:3000" capacitor.config.ts; then
        echo "✅ Capacitor config: Set for local development"
    else
        echo "⚠️  Capacitor config: Set for production (or custom URL)"
    fi
    
    # Check platforms
    if [ -d "ios" ]; then
        echo "✅ iOS platform: Available"
    else
        echo "❌ iOS platform: Not found"
    fi
    
    if [ -d "android" ]; then
        echo "✅ Android platform: Available"
    else
        echo "❌ Android platform: Not found"
    fi
    
    echo ""
    echo "📱 Test your mobile features at: http://localhost:3000/mobile-test"
}

# Function to configure for production
configure_production() {
    echo "🚀 Configuring for production deployment..."
    echo ""
    echo "To deploy your mobile app to production:"
    echo ""
    echo "1. Deploy your app to Vercel:"
    echo "   vercel deploy"
    echo ""
    echo "2. Update capacitor.config.ts with your Vercel URL:"
    echo "   Replace 'http://localhost:3000' with your Vercel URL"
    echo ""
    echo "3. Sync Capacitor:"
    echo "   npm run cap:sync"
    echo ""
    echo "4. Build and deploy your mobile apps:"
    echo "   npm run mobile:dev:ios    # For iOS"
    echo "   npm run mobile:dev:android # For Android"
    echo ""
    echo "📖 See MOBILE_DEVELOPMENT.md for detailed instructions."
}

# Main script
main() {
    if ! check_prerequisites; then
        exit 1
    fi
    
    while true; do
        show_menu
        read -p "Enter your choice (1-9): " choice
        
        case $choice in
            1)
                start_dev_ios
                ;;
            2)
                start_dev_android
                ;;
            3)
                echo "🔄 Syncing Capacitor platforms..."
                npm run cap:sync
                echo "✅ Sync complete!"
                ;;
            4)
                echo "📱 Opening iOS project in Xcode..."
                npm run mobile:dev:ios
                ;;
            5)
                echo "🤖 Opening Android project in Android Studio..."
                npm run mobile:dev:android
                ;;
            6)
                configure_production
                ;;
            7)
                echo "🧪 Opening mobile test page..."
                if command -v open &> /dev/null; then
                    open http://localhost:3000/mobile-test
                else
                    echo "Open http://localhost:3000/mobile-test in your browser"
                fi
                ;;
            8)
                show_status
                ;;
            9)
                echo "👋 Goodbye!"
                exit 0
                ;;
            *)
                echo "❌ Invalid option. Please choose 1-9."
                ;;
        esac
        
        echo ""
        read -p "Press Enter to continue..."
    done
}

# Run the main function
main
