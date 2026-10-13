import type React from "react"
import { AppNav } from "@/components/app-nav"
import { MobileNav } from "@/components/mobile-nav"
import { MonthProvider } from "@/contexts/month-context"
import { AppDataProvider } from "@/contexts/app-data-context"
import { AutoSyncService } from "@/components/auto-sync-service"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MonthProvider>
      <AppDataProvider>
        <AutoSyncService />
        <AppNav />
        {/* Room for the tab bar's home-indicator inset; pages pad for the bar itself */}
        <main className="pb-[env(safe-area-inset-bottom)] md:pb-0">{children}</main>
        <MobileNav />
      </AppDataProvider>
    </MonthProvider>
  )
}
