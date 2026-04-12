'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  MessageSquare,
  Target,
  Settings,
  LogOut,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useMobileSidebar } from './mobile-sidebar-context'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/coach', label: 'AI Coach', icon: MessageSquare },
  { href: '/dashboard/strategy', label: 'Strategy', icon: Target },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <div className="p-6 border-b border-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold text-sm">S</div>
        <h1 className="text-lg font-semibold text-foreground leading-tight tracking-tight">Sana</h1>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-teal-600 text-white'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
          onClick={handleSignOut}
        >
          <LogOut size={16} />
          Sign out
        </Button>
      </div>
    </>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { isOpen, close } = useMobileSidebar()

  useEffect(() => {
    close()
  }, [pathname, close])

  return (
    <>
      <aside className="hidden md:flex w-60 border-r border-border bg-sidebar flex-col h-full">
        <SidebarContent />
      </aside>

      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={close} />
          <aside className="relative w-72 max-w-[85vw] h-full bg-sidebar flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <button onClick={close}
              className="absolute top-4 right-3 p-1.5 rounded-lg hover:bg-muted transition-colors z-10"
              aria-label="Close menu">
              <X size={18} className="text-muted-foreground" />
            </button>
            <SidebarContent onNavClick={close} />
          </aside>
        </div>
      )}
    </>
  )
}
