"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { LayoutDashboard, Receipt, Wallet, TrendingUp, CreditCard, LogOut, ChevronLeft, ChevronRight, Settings } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useMonth } from "@/contexts/month-context"

export function AppNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { selectedMonth, selectedYear, goToPreviousMonth, goToNextMonth } = useMonth()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  // Show month selector on dashboard and budgets pages
  const showMonthSelector = pathname === "/dashboard" || pathname === "/budgets"
  const monthName = new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' })
  const shortMonthName = new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'short' })

  const navItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Transactions",
      href: "/transactions",
      icon: Receipt,
    },
    {
      title: "Budget",
      href: "/budgets",
      icon: Wallet,
    },
    {
      title: "Net Worth",
      href: "/net-worth",
      icon: TrendingUp,
    },
    {
      title: "Accounts",
      href: "/accounts",
      icon: CreditCard,
    },
    {
      title: "Settings",
      href: "/settings",
      icon: Settings,
    },
  ]

  return (
    <nav className="border-b bg-background" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)' }}>
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-xl font-bold">🌿 Bloom Budget</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.href} href={item.href}>
                  <Button variant="ghost" className={cn("gap-2", pathname?.startsWith(item.href) && "bg-muted")}>
                    <Icon className="h-4 w-4" />
                    {item.title}
                  </Button>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Month Navigation */}
          {showMonthSelector && (
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={goToPreviousMonth}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <span className="text-sm font-medium px-2">
                <span className="hidden md:inline">{monthName}</span>
                <span className="md:hidden">{shortMonthName}</span>
                {' '}{selectedYear}
              </span>

              <Button
                variant="ghost"
                size="sm"
                onClick={goToNextMonth}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Desktop Logout Button */}
          <Button variant="ghost" onClick={handleLogout} className="hidden md:flex">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </nav>
  )
}
