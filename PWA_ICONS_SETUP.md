# PWA Icon Setup Guide

To complete the PWA setup, you need to create app icons. Here's how:

## Required Icons

Place these files in the `/public` directory:

1. **icon-192.png** - 192x192 pixels (required for Android)
2. **icon-512.png** - 512x512 pixels (required for Android)
3. **apple-icon.png** - 180x180 pixels (for iOS home screen)
4. **icon-light-32x32.png** - 32x32 pixels (favicon for light mode)
5. **icon-dark-32x32.png** - 32x32 pixels (favicon for dark mode)
6. **icon.svg** - SVG format (scalable favicon)

## Quick Generation Methods

### Option 1: Use an Online Tool (Recommended)
1. Go to [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator)
2. Upload a square logo/icon (at least 512x512 px)
3. Download the generated icon pack
4. Place the icons in the `/public` directory

### Option 2: Use Figma or Design Tool
1. Create a 512x512 canvas
2. Design your app icon with the wallet/budget theme
3. Export at multiple sizes:
   - 192x192
   - 512x512
   - 180x180
   - 32x32

### Option 3: Use ImageMagick (Command Line)
If you have a source icon (source.png):

```bash
# Create 192x192
convert source.png -resize 192x192 public/icon-192.png

# Create 512x512
convert source.png -resize 512x512 public/icon-512.png

# Create Apple icon 180x180
convert source.png -resize 180x180 public/apple-icon.png

# Create favicons 32x32
convert source.png -resize 32x32 public/icon-light-32x32.png
convert source.png -resize 32x32 public/icon-dark-32x32.png
```

## Design Tips

- **Simple & Recognizable**: Use a clear, simple design that works at small sizes
- **Budget Theme**: Consider using a wallet 💰, piggy bank, or dollar sign
- **Color**: Use the app's theme color (#3b82f6 - blue)
- **Padding**: Leave some padding around the icon (about 10% on each side)
- **Safe Zone**: Keep important elements within the center 80% of the icon
- **Masked Icons**: Ensure the icon looks good when cropped to a circle (Android)

## Optional Screenshots

For a better PWA install experience, add screenshots to `/public`:

1. **screenshot-mobile.png** - 390x844 pixels (mobile view)
2. **screenshot-desktop.png** - 1920x1080 pixels (desktop view)

Take screenshots of:
- Dashboard view
- Transactions page
- Budget overview

## Temporary Solution

If you want to test PWA functionality immediately without creating icons, you can use simple colored squares:

```bash
# Create temporary placeholder icons (requires ImageMagick)
convert -size 192x192 xc:'#3b82f6' public/icon-192.png
convert -size 512x512 xc:'#3b82f6' public/icon-512.png
convert -size 180x180 xc:'#3b82f6' public/apple-icon.png
convert -size 32x32 xc:'#3b82f6' public/icon-light-32x32.png
convert -size 32x32 xc:'#1e40af' public/icon-dark-32x32.png
```

## Verification

After adding icons:
1. Deploy to Vercel
2. Open your app in a mobile browser
3. Look for "Add to Home Screen" or "Install App" prompt
4. Check that icons appear correctly in the install dialog

## Resources

- [PWA Builder Image Generator](https://www.pwabuilder.com/imageGenerator)
- [App Icon Generator](https://www.appicon.co/)
- [Favicon Generator](https://realfavicongenerator.net/)
- [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/)
