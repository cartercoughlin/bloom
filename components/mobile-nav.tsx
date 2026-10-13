"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Receipt, Target, CreditCard, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

export function MobileNav() {
  const pathname = usePathname()

  const navItems: { href: string; label: string; icon: typeof Home; also?: string[] }[] = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: Home,
    },
    {
      href: "/budgets",
      label: "Budgets",
      icon: Target,
    },
    {
      href: "/transactions",
      label: "Transactions",
      icon: Receipt,
    },
    {
      href: "/accounts",
      label: "Accounts",
      icon: CreditCard,
      // Net Worth opens from the Accounts tab, so keep the tab lit there
      also: ["/net-worth"],
    },
    {
      href: "/settings",
      label: "Settings",
      icon: Settings,
    },
  ]

  return (
    // iOS-style tab bar: full width, translucent, clears the home indicator
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background/80 backdrop-blur-xl backdrop-saturate-150 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-stretch h-[50px]">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = [item.href, ...(item.also || [])].some(href => pathname?.startsWith(href))

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center flex-1 gap-0.5 pt-1 transition-colors active:opacity-60",
                isActive ? "text-green-600" : "text-muted-foreground"
              )}
            >
              <Icon className="h-6 w-6" strokeWidth={isActive ? 2.25 : 1.75} />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
