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
        {children}
        <MobileNav />
      </AppDataProvider>
    </MonthProvider>
  )
}
