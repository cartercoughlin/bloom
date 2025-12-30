"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { LayoutDashboard, Receipt, Wallet, FolderKanban, TrendingUp, CreditCard, LogOut, ChevronLeft, ChevronRight } from "lucide-react"
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
      title: "Categories",
      href: "/categories",
      icon: FolderKanban,
    },
    {
      title: "Accounts",
      href: "/accounts", 
      icon: CreditCard,
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
            <div className="flex items-center gap-1 md:gap-2 mr-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousMonth}
                className="h-7 w-7 md:h-8 md:w-8 p-0"
              >
                <ChevronLeft className="h-3 w-3 md:h-4 md:w-4" />
              </Button>

              <div className="text-xs md:text-sm font-medium min-w-[90px] md:min-w-[120px] text-center">
                {monthName} {selectedYear}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={goToNextMonth}
                className="h-7 w-7 md:h-8 md:w-8 p-0"
              >
                <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />
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
