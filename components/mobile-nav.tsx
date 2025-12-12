"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Receipt, Target, FolderOpen } from "lucide-react"
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
      href: "/transactions",
      label: "Transactions",
      icon: Receipt,
    },
    {
      href: "/budgets",
      label: "Budgets",
      icon: Target,
    },
    {
      href: "/categories",
      label: "Categories",
      icon: FolderOpen,
    },
  ]

  return (
    <nav className="fixed bottom-8 left-0 right-0 z-50 bg-background border-t md:hidden">
      <div className="flex items-center justify-around h-14">
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
