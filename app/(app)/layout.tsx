import type React from "react"
import { AppNav } from "@/components/app-nav"
import { MobileNav } from "@/components/mobile-nav"
import { PullToRefresh } from "@/components/pull-to-refresh"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <PullToRefresh />
      <AppNav />
      {children}
      <MobileNav />
    </>
  )
}
