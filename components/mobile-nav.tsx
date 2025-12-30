"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Receipt, Target, TrendingUp, FolderOpen, CreditCard } from "lucide-react"
import { cn } from "@/lib/utils"

export function MobileNav() {
  const pathname = usePathname()

  const navItems = [
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
    },
  ]

  return (
    <nav className="fixed bottom-6 left-4 right-4 z-50 bg-background/95 backdrop-blur-sm border rounded-full shadow-lg md:hidden">
      <div className="flex items-center justify-evenly h-12">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname?.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
