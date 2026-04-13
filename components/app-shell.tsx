"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  TableProperties,
  Bot,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const navItems = [
  { href: "/cartera", label: "Cartera", icon: TableProperties },
  { href: "/analisis-ia", label: "Analisis IA", icon: Bot },
  { href: "/historico", label: "Historico", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
]

async function handleSignOut() {
  // next-auth v5 CSRF signout
  const res = await fetch("/api/auth/csrf")
  const { csrfToken } = await res.json()
  const form = new FormData()
  form.append("csrfToken", csrfToken)
  await fetch("/api/auth/signout", { method: "POST", body: form })
  window.location.href = "/login"
}

export function AppShell({
  userName,
  children,
}: {
  userName?: string | null
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-white md:flex">
        {/* Logo */}
        <div className="border-b px-6 py-5">
          <h1 className="text-xl font-bold text-blue-600">CobranzasAI</h1>
          <p className="text-xs text-muted-foreground">
            Sistema de cobranzas inteligente
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t px-3 py-4">
          {userName && (
            <p className="mb-2 px-3 text-xs text-muted-foreground truncate">
              {userName}
            </p>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-gray-600 hover:text-gray-900"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesion
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
