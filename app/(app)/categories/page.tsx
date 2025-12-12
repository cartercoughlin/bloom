import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CategoryList } from "@/components/category-list"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, Settings } from "lucide-react"

export default async function CategoriesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login")
  }

  const { data: categories } = await supabase.from("categories").select("*").order("name")

  return (
    <div className="container mx-auto p-3 md:p-6 max-w-7xl pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-4 md:mb-8">
        <div>
          <h1 className="text-xl md:text-3xl font-bold mb-1 md:mb-2">Categories</h1>
          <p className="text-muted-foreground text-xs md:text-sm">Manage your spending categories</p>
        </div>
        <div className="flex gap-2">
          <Link href="/categories/rules">
            <Button variant="outline" className="text-xs md:text-sm h-8 md:h-10 px-2 md:px-4">
              <Settings className="mr-0 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden md:inline">Rules</span>
            </Button>
          </Link>
          <Link href="/categories/new">
            <Button className="text-xs md:text-sm h-8 md:h-10 px-2 md:px-4">
              <Plus className="mr-0 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Add Category</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </Link>
        </div>
      </div>

      <CategoryList categories={categories || []} />
    </div>
  )
}
