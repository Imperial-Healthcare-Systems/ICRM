'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard, UserCircle, Building2, TrendingUp,
  CalendarCheck, Receipt,
  Truck, TicketCheck, MapPin, Gift, Mail, MessageSquare,
  FolderOpen, BarChart3, Zap, Brain, Globe, Settings,
  LogOut, ChevronDown, Star, CreditCard,
  FolderKanban,
  CalendarDays, BookOpen, Bell,
  Target, Sun, Moon, Monitor,
} from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'
import Avatar from './ui/Avatar'
import { useTheme } from './ThemeProvider'
import type { Theme } from '@/lib/theme'

type NavItem = {
  label: string
  href?: string
  icon: React.ReactNode
  children?: { label: string; href: string }[]
  badge?: string
}

const NAV: NavItem[] = [
  { label: 'Dashboard',      href: '/dashboard',       icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: 'Calendar',       href: '/calendar',         icon: <CalendarDays className="w-4 h-4" /> },
  { label: 'Leads',          href: '/leads',            icon: <Star className="w-4 h-4" /> },
  { label: 'Contacts',       href: '/contacts',         icon: <UserCircle className="w-4 h-4" /> },
  { label: 'Accounts',       href: '/accounts',         icon: <Building2 className="w-4 h-4" /> },
  { label: 'Deals',          href: '/deals',            icon: <TrendingUp className="w-4 h-4" /> },
  { label: 'Activities',     href: '/activities',       icon: <CalendarCheck className="w-4 h-4" /> },
  { label: 'Communications', href: '/communications',   icon: <MessageSquare className="w-4 h-4" /> },
  {
    label: 'Finance',
    icon: <Receipt className="w-4 h-4" />,
    children: [
      { label: 'Estimates',      href: '/estimates' },
      { label: 'Quotations',     href: '/quotations' },
      { label: 'Invoices',       href: '/invoices' },
      { label: 'Contracts',      href: '/contracts' },
      { label: 'Proposals',      href: '/proposals' },
      { label: 'Purchase Orders',href: '/purchase-orders' },
      { label: 'Expenses',       href: '/expenses' },
      { label: 'Products',       href: '/products' },
      { label: 'Subscriptions',  href: '/subscriptions' },
    ],
  },
  {
    label: 'Performance',
    icon: <Target className="w-4 h-4" />,
    children: [
      { label: 'Territories', href: '/territories' },
      { label: 'Quotas',      href: '/quotas' },
    ],
  },
  {
    label: 'Delivery',
    icon: <FolderKanban className="w-4 h-4" />,
    children: [
      { label: 'Projects',   href: '/projects' },
      { label: 'Tasks',      href: '/tasks' },
      { label: 'Timesheets', href: '/timesheets' },
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
      { label: 'Email Campaigns',  href: '/campaigns' },
      { label: 'Email Sequences',  href: '/email-sequences' },
      { label: 'WhatsApp',         href: '/whatsapp' },
    ],
  },
  { label: 'Knowledge Base', href: '/knowledge-base',   icon: <BookOpen className="w-4 h-4" /> },
  { label: 'Announcements',  href: '/announcements',    icon: <Bell className="w-4 h-4" /> },
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

const THEME_OPTIONS: { value: Theme; icon: React.ReactNode; label: string }[] = [
  { value: 'light',  icon: <Sun     className="w-3.5 h-3.5" />, label: 'Light' },
  { value: 'dark',   icon: <Moon    className="w-3.5 h-3.5" />, label: 'Dark' },
  { value: 'system', icon: <Monitor className="w-3.5 h-3.5" />, label: 'Auto' },
]

export default function Sidebar({ userName, orgName, planTier }: SidebarProps) {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState<string[]>([])
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { theme, setTheme } = useTheme()

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

  // Sidebar uses fixed dark tokens — applied via .sidebar-shell wrapper class
  return (
    <aside className="sidebar-shell fixed inset-y-0 left-0 w-60 border-r border-[var(--sidebar-border)] flex flex-col z-40">
      {/* Logo */}
      <div className="px-3 h-16 border-b border-[var(--sidebar-border)] shrink-0 flex items-center justify-center">
        <img src="/iti_logo_2.png" alt="Imperial CRM — Imperial Tech Innovations" className="w-full h-auto max-h-12 object-contain" />
      </div>

      {/* Plan badge */}
      <div className="px-4 pt-3 pb-2 border-b border-[var(--sidebar-border)]">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-[var(--sidebar-accent-bright)] text-[var(--sidebar-accent)] text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-[0.12em]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--sidebar-accent)] animate-pulse" />
            {planTier}
          </span>
        </div>
        <p className="text-[var(--sidebar-text-faint)] text-[10px] mt-1.5 truncate">{orgName}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-hide">
        {NAV.map(item => {
          if (item.children) {
            const open = expanded.includes(item.label) || isGroupActive(item.children)
            const groupActive = isGroupActive(item.children)
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={clsx(
                    'w-full flex items-center gap-2.5 pl-3 pr-2.5 py-2 rounded-lg text-sm font-medium transition group relative',
                    groupActive
                      ? 'text-[var(--sidebar-text-primary)] bg-[var(--sidebar-item-active)]'
                      : 'text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text-secondary)] hover:bg-[var(--sidebar-item-hover)]'
                  )}
                >
                  <span className={clsx('transition', groupActive ? 'text-[var(--sidebar-accent)]' : 'text-[var(--sidebar-text-faint)] group-hover:text-[var(--sidebar-text-muted)]')}>
                    {item.icon}
                  </span>
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown className={clsx(
                    'w-3.5 h-3.5 text-[var(--sidebar-text-faint)] transition-transform duration-200',
                    open ? 'rotate-0' : '-rotate-90',
                  )} />
                </button>
                <div className={clsx(
                  'overflow-hidden transition-[grid-template-rows] duration-300 ease-out grid',
                  open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                )}>
                  <div className="overflow-hidden">
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l border-[var(--sidebar-border)] pl-3 pb-1">
                      {item.children.map(child => {
                        const childActive = isActive(child.href)
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={clsx(
                              'block px-3 py-1.5 rounded-md text-xs font-medium transition relative',
                              childActive
                                ? 'text-[var(--sidebar-accent)] bg-[var(--sidebar-accent-soft)]'
                                : 'text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text-secondary)] hover:bg-[var(--sidebar-item-hover)]'
                            )}
                          >
                            {childActive && <span className="absolute -left-[13px] top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-[var(--sidebar-accent)]" />}
                            {child.label}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )
          }

          const active = isActive(item.href!)
          return (
            <Link
              key={item.href}
              href={item.href!}
              className={clsx(
                'flex items-center gap-2.5 pl-3 pr-2.5 py-2 rounded-lg text-sm font-medium transition group relative',
                active
                  ? 'text-[var(--sidebar-text-primary)] bg-[var(--sidebar-item-active)]'
                  : 'text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text-secondary)] hover:bg-[var(--sidebar-item-hover)]'
              )}
            >
              {/* Orange edge indicator on active item */}
              {active && (
                <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[var(--sidebar-accent)]" />
              )}
              <span className={clsx(
                'transition',
                active ? 'text-[var(--sidebar-accent)]' : 'text-[var(--sidebar-text-faint)] group-hover:text-[var(--sidebar-text-muted)]'
              )}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="bg-[var(--sidebar-accent-bright)] text-[var(--sidebar-accent)] text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-[var(--sidebar-border)] shrink-0 relative">
        {userMenuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
            <div className="absolute bottom-full left-2 right-2 mb-1 bg-[var(--sidebar-bg-elevated)] border border-[var(--sidebar-border-strong)] rounded-xl p-1.5 shadow-2xl anim-scale-in z-20 origin-bottom">
              {/* Theme picker */}
              <div className="px-2 py-1.5">
                <p className="text-[var(--sidebar-text-faint)] text-[9px] uppercase tracking-[0.12em] font-bold mb-1.5">Theme</p>
                <div className="flex bg-[var(--sidebar-item-hover)] rounded-lg p-0.5 gap-0.5">
                  {THEME_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setTheme(opt.value)}
                      title={opt.label}
                      className={clsx(
                        'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-semibold transition',
                        theme === opt.value
                          ? 'bg-[var(--sidebar-accent-bright)] text-[var(--sidebar-accent)]'
                          : 'text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text-primary)]'
                      )}
                    >
                      {opt.icon}
                      <span className="hidden xl:inline">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-px bg-[var(--sidebar-border)] mx-1.5 my-1" />
              <Link
                href="/settings/profile"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-[var(--sidebar-text-secondary)] hover:text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-item-hover)] text-xs font-medium transition"
              >
                <Settings className="w-3.5 h-3.5" />
                Settings
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs font-medium transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          </>
        )}
        <button
          onClick={() => setUserMenuOpen(o => !o)}
          className={clsx(
            'w-full flex items-center gap-2.5 px-3 py-3 hover:bg-[var(--sidebar-item-hover)] transition group',
            userMenuOpen && 'bg-[var(--sidebar-item-hover)]',
          )}
        >
          <Avatar name={userName} brand size="sm" />
          <div className="min-w-0 flex-1 text-left">
            <p className="text-[var(--sidebar-text-primary)] text-xs font-semibold truncate">{userName}</p>
            <p className="text-[var(--sidebar-text-faint)] text-[10px] truncate">View profile</p>
          </div>
          <ChevronDown className={clsx(
            'w-3.5 h-3.5 text-[var(--sidebar-text-faint)] transition-transform duration-200 shrink-0',
            userMenuOpen ? 'rotate-180' : '',
          )} />
        </button>
      </div>
    </aside>
  )
}
