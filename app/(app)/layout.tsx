import type React from "react"
import { AppNav } from "@/components/app-nav"
import { MobileNav } from "@/components/mobile-nav"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { MonthProvider } from "@/contexts/month-context"
import { AutoSyncService } from "@/components/auto-sync-service"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MonthProvider>
      <AutoSyncService />
      <PullToRefresh />
      <AppNav />
      {children}
      <MobileNav />
    </MonthProvider>
  )
}
