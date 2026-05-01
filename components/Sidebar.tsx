'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard, Users, UserCircle, Building2, TrendingUp,
  CalendarCheck, FileText, Receipt, FileSignature, ShoppingCart,
  Truck, TicketCheck, MapPin, Gift, Mail, MessageSquare,
  FolderOpen, BarChart3, Zap, Brain, Globe, Settings,
  LogOut, ChevronDown, ChevronRight, Star, CreditCard,
} from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'

type NavItem = {
  label: string
  href?: string
  icon: React.ReactNode
  children?: { label: string; href: string }[]
  badge?: string
}

const NAV: NavItem[] = [
  { label: 'Dashboard',      href: '/dashboard',       icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: 'Leads',          href: '/leads',            icon: <Star className="w-4 h-4" /> },
  { label: 'Contacts',       href: '/contacts',         icon: <UserCircle className="w-4 h-4" /> },
  { label: 'Accounts',       href: '/accounts',         icon: <Building2 className="w-4 h-4" /> },
  { label: 'Deals',          href: '/deals',            icon: <TrendingUp className="w-4 h-4" /> },
  { label: 'Activities',     href: '/activities',       icon: <CalendarCheck className="w-4 h-4" /> },
  {
    label: 'Finance',
    icon: <Receipt className="w-4 h-4" />,
    children: [
      { label: 'Quotations',     href: '/quotations' },
      { label: 'Invoices',       href: '/invoices' },
      { label: 'Contracts',      href: '/contracts' },
      { label: 'Proposals',      href: '/proposals' },
      { label: 'Purchase Orders',href: '/purchase-orders' },
    ],
  },
  { label: 'Vendors',        href: '/vendors',          icon: <Truck className="w-4 h-4" /> },
  { label: 'Support',        href: '/support',          icon: <TicketCheck className="w-4 h-4" /> },
  { label: 'Field Visits',   href: '/field-visits',     icon: <MapPin className="w-4 h-4" /> },
  { label: 'Loyalty',        href: '/loyalty',          icon: <Gift className="w-4 h-4" /> },
  {
    label: 'Marketing',
    icon: <Mail className="w-4 h-4" />,
    children: [
      { label: 'Email Campaigns', href: '/campaigns' },
      { label: 'WhatsApp',        href: '/whatsapp' },
    ],
  },
  { label: 'Documents',      href: '/documents',        icon: <FolderOpen className="w-4 h-4" /> },
  { label: 'Reports',        href: '/reports',          icon: <BarChart3 className="w-4 h-4" /> },
  { label: 'Automation',     href: '/automation',       icon: <Zap className="w-4 h-4" /> },
  { label: 'Intelligence',   href: '/intelligence',     icon: <Brain className="w-4 h-4" />, badge: 'AI' },
  { label: 'Ecosystem',      href: '/ecosystem',        icon: <Globe className="w-4 h-4" /> },
  { label: 'Billing',        href: '/billing',          icon: <CreditCard className="w-4 h-4" /> },
  {
    label: 'Settings',
    icon: <Settings className="w-4 h-4" />,
    children: [
      { label: 'Organisation', href: '/settings/organisation' },
      { label: 'Team',         href: '/settings/team' },
      { label: 'Pipeline',     href: '/settings/pipeline' },
      { label: 'My Profile',   href: '/settings/profile' },
      { label: 'Integrations', href: '/settings/integrations' },
    ],
  },
]

interface SidebarProps {
  userName: string
  orgName: string
  planTier: string
}

export default function Sidebar({ userName, orgName, planTier }: SidebarProps) {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState<string[]>([])

  function toggleGroup(label: string) {
    setExpanded(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    )
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  function isGroupActive(children: { href: string }[]) {
    return children.some(c => isActive(c.href))
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-[#07111F] border-r border-white/5 flex flex-col z-40">
      {/* Logo */}
      <div className="px-2 h-14 border-b border-white/5 shrink-0 flex items-center justify-center">
        <img src="/iti_logo_2.png" alt="Imperial CRM — Imperial Tech Innovations" className="w-full h-auto max-h-12 object-contain" />
      </div>

      {/* Plan badge */}
      <div className="px-4 py-2 border-b border-white/5">
        <span className="inline-flex items-center gap-1 bg-[#F47920]/15 text-[#F47920] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
          {planTier}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-hide">
        {NAV.map(item => {
          if (item.children) {
            const open = expanded.includes(item.label) || isGroupActive(item.children)
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition group',
                    isGroupActive(item.children)
                      ? 'text-white bg-white/8'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  )}
                >
                  <span className={isGroupActive(item.children) ? 'text-[#F47920]' : 'text-slate-500 group-hover:text-slate-300'}>
                    {item.icon}
                  </span>
                  <span className="flex-1 text-left">{item.label}</span>
                  {open
                    ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                    : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                </button>
                {open && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/5 pl-3">
                    {item.children.map(child => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={clsx(
                          'block px-3 py-1.5 rounded-lg text-xs font-medium transition',
                          isActive(child.href)
                            ? 'text-[#F47920] bg-[#F47920]/10'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href!}
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition group',
                isActive(item.href!)
                  ? 'text-white bg-white/8'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              )}
            >
              <span className={clsx(
                'transition',
                isActive(item.href!) ? 'text-[#F47920]' : 'text-slate-500 group-hover:text-slate-300'
              )}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="bg-[#F47920]/20 text-[#F47920] text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/5 p-3 shrink-0">
        <div className="flex items-center gap-2.5 mb-2 px-1">
          <div className="w-7 h-7 rounded-full bg-[#F47920]/20 flex items-center justify-center text-[#F47920] text-xs font-bold shrink-0">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-medium truncate">{userName}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 text-xs font-medium transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
