import type React from "react"
import { AppNav } from "@/components/app-nav"
import { MobileNav } from "@/components/mobile-nav"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { MonthProvider } from "@/contexts/month-context"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MonthProvider>
      <PullToRefresh />
      <AppNav />
      {children}
      <MobileNav />
    </MonthProvider>
  )
}
