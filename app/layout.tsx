import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { RegisterServiceWorker } from "./register-sw"
import { PWAUpdatePrompt } from "@/components/pwa-update-prompt"
import { ThemeProvider } from "@/components/theme-provider"
import { PrivacyProvider } from "@/contexts/privacy-context"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' }
  ],
  viewportFit: 'cover', // Enable safe area insets for iOS notch
}

export const metadata: Metadata = {
  title: "Bloom Budget - Track Your Spending",
  description: "Budget tracking app with transaction imports from Chase, Citi, and First Horizon",
  generator: "v0.app",
  applicationName: "Bloom Budget",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bloom Budget",
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
      {
        url: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PrivacyProvider>
            {children}
          </PrivacyProvider>
        </ThemeProvider>
        <Analytics />
        <RegisterServiceWorker />
        <PWAUpdatePrompt />
      </body>
    </html>
  )
}
