# Mobile Development with Capacitor

Your Budget App is now fully configured for mobile development with Capacitor! Here's how to continue building and testing the mobile app.

## Current Status ✅

- ✅ Capacitor 8 installed and configured
- ✅ iOS and Android platforms added
- ✅ Mobile utilities implemented (`lib/capacitor.ts`)
- ✅ Haptic feedback hooks (`hooks/use-haptics.ts`)
- ✅ Keyboard handling hooks (`hooks/use-keyboard.ts`)
- ✅ Safe area CSS utilities for iOS notch/home indicator
- ✅ Mobile navigation component
- ✅ PWA support with service worker
- ✅ Mobile-optimized UI components

## Quick Start

### 1. Local Development Testing

```bash
# Start the Next.js dev server
npm run dev:mobile

# In another terminal, open iOS simulator
npm run mobile:dev:ios

# Or open Android emulator
npm run mobile:dev:android
```

The mobile app will connect to your local development server at `http://localhost:3000`.

### 2. Production Deployment

1. **Deploy to Vercel:**
   ```bash
   vercel deploy
   ```

2. **Update Capacitor config with your Vercel URL:**
   ```typescript
   // In capacitor.config.ts
   server: {
     url: 'https://your-actual-vercel-url.vercel.app',
     // Comment out local development lines
   }
   ```

3. **Sync and build:**
   ```bash
   npm run cap:sync
   npm run mobile:dev:ios  # or mobile:dev:android
   ```

## Mobile Features Implemented

### 🎯 Haptic Feedback
All buttons automatically provide haptic feedback. Custom usage:

```typescript
import { useHaptics } from '@/hooks/use-haptics'

const haptics = useHaptics()
haptics.light()    // Light tap
haptics.success()  // Success notification
haptics.error()    // Error notification
```

### ⌨️ Smart Keyboard Handling
Automatically scrolls inputs into view when keyboard appears:

```typescript
import { useKeyboard } from '@/hooks/use-keyboard'

const { isKeyboardVisible, hideKeyboard } = useKeyboard({
  autoScroll: true,
  scrollOffset: 20
})
```

### 📱 Safe Area Support
CSS utilities for iOS notch and home indicator:

```tsx
<div className="safe-top">Content respects status bar</div>
<div className="safe-bottom">Content respects home indicator</div>
<div className="safe-area">Content respects all safe areas</div>
<div className="h-screen-safe">Full height minus safe areas</div>
```

### 💾 Native Storage
Replaces localStorage with native storage:

```typescript
import { storage, cache } from '@/lib/capacitor'

// Simple storage
await storage.set('key', 'value')
const value = await storage.get('key')

// JSON caching
await cache.setJSON('user', { name: 'John' })
const user = await cache.getJSON('user')
```

### 🔍 Platform Detection
```typescript
import { isNativePlatform, isIOS, isAndroid } from '@/lib/capacitor'

if (isNativePlatform()) {
  // Native-specific code
}
```

## Development Workflow

### Testing on iOS Simulator

1. **Prerequisites:**
   - macOS with Xcode 14+ installed
   - iOS Simulator

2. **Run:**
   ```bash
   npm run dev:mobile        # Start Next.js dev server
   npm run mobile:dev:ios    # Open Xcode project
   ```

3. **In Xcode:**
   - Select a simulator (iPhone 15, iPad, etc.)
   - Click the Play button to build and run

### Testing on Android Emulator

1. **Prerequisites:**
   - Android Studio installed
   - Android SDK and emulator configured

2. **Run:**
   ```bash
   npm run dev:mobile           # Start Next.js dev server
   npm run mobile:dev:android   # Open Android Studio project
   ```

3. **In Android Studio:**
   - Start an emulator
   - Click Run to build and install

### Testing on Physical Devices

1. **iOS Device:**
   - Connect iPhone/iPad via USB
   - Select your device in Xcode
   - Ensure you're signed in with Apple Developer account
   - Click Run

2. **Android Device:**
   - Enable Developer Options and USB Debugging
   - Connect via USB
   - Select your device in Android Studio
   - Click Run

## Mobile-Specific Optimizations

### Performance
- Client-side rendering for heavy pages (dashboard, transactions)
- Capacitor Storage caching for instant loads
- Service worker for offline support

### UI/UX
- 44px minimum tap targets for accessibility
- Touch-optimized interactions
- Mobile-first responsive design
- Bottom navigation for easy thumb access

### Native Features
- Status bar styling
- Splash screen configuration
- Hardware back button handling (Android)
- Keyboard resize behavior

## Troubleshooting

### Common Issues

**"Bundle Identifier cannot be registered" (iOS):**
```typescript
// In capacitor.config.ts, change appId to something unique:
appId: 'com.yourname.budgetapp'
```

**App shows placeholder instead of your app:**
- Ensure Next.js dev server is running (`npm run dev:mobile`)
- Check that `capacitor.config.ts` has the correct server URL
- Run `npm run cap:sync` after config changes

**Build errors in Xcode/Android Studio:**
- Clean build folder
- Update to latest Xcode/Android Studio
- Check that all dependencies are installed

**Data not persisting:**
- Verify you're using `await` with storage operations
- Check that Capacitor Storage permissions are granted

### Development Tips

1. **Use Chrome DevTools for debugging:**
   - iOS: Safari → Develop → [Your Device] → [Your App]
   - Android: Chrome → chrome://inspect → [Your Device]

2. **Hot reload during development:**
   - Changes to your Next.js app will automatically reload in the mobile app
   - No need to rebuild the native app for code changes

3. **Test on multiple screen sizes:**
   - Use different simulator sizes
   - Test on both phones and tablets

## Next Steps

1. **Deploy to App Stores:**
   - iOS: Use Xcode to archive and upload to App Store Connect
   - Android: Use Android Studio to generate signed APK/AAB

2. **Add more native features:**
   - Camera access for receipt scanning
   - Push notifications
   - Biometric authentication
   - File system access

3. **Performance monitoring:**
   - Add analytics
   - Monitor crash reports
   - Track user engagement

Your mobile app is ready for development! Start with local testing, then deploy to production for a full mobile experience.
