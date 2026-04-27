'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, Users, GitBranch, User, Puzzle, CreditCard } from 'lucide-react'
import clsx from 'clsx'

const SETTINGS_NAV = [
  { href: '/settings/organisation', label: 'Organisation',  icon: <Building2 className="w-4 h-4" /> },
  { href: '/settings/team',         label: 'Team',          icon: <Users className="w-4 h-4" /> },
  { href: '/settings/pipeline',     label: 'Pipeline',      icon: <GitBranch className="w-4 h-4" /> },
  { href: '/settings/profile',      label: 'My Profile',    icon: <User className="w-4 h-4" /> },
  { href: '/billing',               label: 'Billing',       icon: <CreditCard className="w-4 h-4" /> },
  { href: '/settings/integrations', label: 'Integrations',  icon: <Puzzle className="w-4 h-4" /> },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen">
      {/* Settings sidebar */}
      <aside className="w-52 shrink-0 border-r border-white/5 py-6 px-3">
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest px-3 mb-3">Settings</p>
        <nav className="space-y-0.5">
          {SETTINGS_NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition',
                pathname === item.href || pathname.startsWith(item.href + '/')
                  ? 'bg-[#F47920]/10 text-[#F47920]'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Settings content */}
      <div className="flex-1 overflow-x-hidden">
        {children}
      </div>
    </div>
  )
}
