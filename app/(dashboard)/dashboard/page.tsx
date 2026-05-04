import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import {
  Star, UserCircle, Building2, TrendingUp,
  TicketCheck, CalendarCheck, Brain, AlertTriangle,
  ArrowRight, Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import StatCard from '@/components/ui/StatCard'
import StatusPill, { pillToneForStatus } from '@/components/ui/StatusPill'
import Avatar from '@/components/ui/Avatar'

async function getDashboardStats(orgId: string) {
  const [leads, contacts, accounts, deals, tickets, activities, credits] = await Promise.all([
    supabaseAdmin.from('crm_leads').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('lead_status', 'new'),
    supabaseAdmin.from('crm_contacts').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    supabaseAdmin.from('crm_accounts').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    supabaseAdmin.from('crm_deals').select('deal_value').eq('org_id', orgId).eq('deal_status', 'open'),
    supabaseAdmin.from('crm_tickets').select('id', { count: 'exact', head: true }).eq('org_id', orgId).in('status', ['open', 'in_progress']),
    supabaseAdmin.from('crm_activities').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'pending'),
    supabaseAdmin.from('org_credits').select('balance').eq('org_id', orgId).single(),
  ])

  const openDealsValue = (deals.data ?? []).reduce((sum, d) => sum + Number(d.deal_value), 0)

  return {
    newLeads: leads.count ?? 0,
    contacts: contacts.count ?? 0,
    accounts: accounts.count ?? 0,
    openDealsValue,
    openTickets: tickets.count ?? 0,
    pendingActivities: activities.count ?? 0,
    credits: credits.data?.balance ?? 0,
  }
}

async function getRecentDeals(orgId: string) {
  const { data } = await supabaseAdmin
    .from('crm_deals')
    .select('id, title, deal_value, deal_status, expected_close, crm_accounts(name)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(5)
  return data ?? []
}

function fmt(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000)     return `₹${(n / 1000).toFixed(1)}K`
  return `₹${n.toLocaleString('en-IN')}`
}

const QUICK_ADD = [
  { label: 'New Lead',     href: '/leads/new',      dot: 'bg-[#F47920]' },
  { label: 'New Contact',  href: '/contacts/new',   dot: 'bg-blue-400' },
  { label: 'New Deal',     href: '/deals/new',      dot: 'bg-emerald-400' },
  { label: 'Log Activity', href: '/activities/new', dot: 'bg-purple-400' },
]

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const { orgId } = session.user
  const [stats, recentDeals] = await Promise.all([
    getDashboardStats(orgId),
    getRecentDeals(orgId),
  ])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = session.user.name?.split(' ')[0] ?? 'there'

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Greeting hero */}
      <div className="mb-7 anim-rise">
        <p className="text-kicker text-[#F47920] mb-2">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="text-display text-white">
          {greeting}, <span className="text-[#F47920]">{firstName}</span>.
        </h1>
        <p className="text-slate-400 text-sm mt-2">Here&apos;s what&apos;s happening across your CRM today.</p>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <StatCard label="New Leads"     value={stats.newLeads}                tone="orange"  icon={<Star className="w-[18px] h-[18px]" />}        href="/leads" />
        <StatCard label="Contacts"      value={stats.contacts}                tone="blue"    icon={<UserCircle className="w-[18px] h-[18px]" />}  href="/contacts" />
        <StatCard label="Accounts"      value={stats.accounts}                tone="purple"  icon={<Building2 className="w-[18px] h-[18px]" />}   href="/accounts" />
        <StatCard label="Open Pipeline" value={fmt(stats.openDealsValue)}     tone="emerald" icon={<TrendingUp className="w-[18px] h-[18px]" />}  href="/deals" />
        <StatCard label="Open Tickets"  value={stats.openTickets}             tone="yellow"  icon={<TicketCheck className="w-[18px] h-[18px]" />} href="/support" />
        <StatCard label="Pending Tasks" value={stats.pendingActivities}       tone="pink"    icon={<CalendarCheck className="w-[18px] h-[18px]" />} href="/activities" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Recent deals */}
        <div className="xl:col-span-2 surface-premium overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h2 className="text-headline text-white">Recent Deals</h2>
              <p className="text-slate-500 text-xs mt-0.5">Latest 5 from your pipeline</p>
            </div>
            <Link href="/deals" className="text-[#F47920] text-xs font-semibold hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="hairline" />
          {recentDeals.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-slate-500 text-sm">No deals yet.</p>
              <Link href="/deals/new" className="text-[#F47920] text-sm font-semibold hover:underline mt-1 inline-flex items-center gap-1">
                Create your first deal <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {recentDeals.map((deal: any) => (
                <Link
                  key={deal.id}
                  href={`/deals/${deal.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition group"
                >
                  <Avatar name={(deal.crm_accounts as any)?.name ?? deal.title} id={deal.id} size="sm" ring={false} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate group-hover:text-[#F47920] transition">{deal.title}</p>
                    <p className="text-slate-500 text-xs truncate mt-0.5">
                      {(deal.crm_accounts as any)?.name ?? 'No account'}
                      {deal.expected_close && (
                        <> · <span className="tabular-nums">Closes {new Date(deal.expected_close).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-white text-sm font-bold tabular-nums">{fmt(Number(deal.deal_value))}</p>
                    <StatusPill tone={pillToneForStatus(deal.deal_status)} size="xs" className="mt-1">
                      {deal.deal_status.replace('_', ' ')}
                    </StatusPill>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* AI Credits */}
          <div className="surface-premium p-5 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-[#F47920]/10 blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#F47920]/15 text-[#F47920] flex items-center justify-center">
                    <Brain className="w-4 h-4" />
                  </div>
                  <h2 className="text-headline text-white">Imperial Intelligence</h2>
                </div>
                <Sparkles className="w-3.5 h-3.5 text-[#F47920]/60" />
              </div>
              <p className="text-display text-white tabular-nums leading-none">{stats.credits.toLocaleString('en-IN')}</p>
              <p className="text-slate-500 text-xs mt-1.5">AI credits remaining</p>
              {stats.credits < 20 && (
                <div className="mt-3 flex items-center gap-1.5 text-yellow-400 text-xs bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Credits running low
                </div>
              )}
              <Link
                href="/settings/billing"
                className="mt-4 flex items-center justify-center gap-1 text-xs font-semibold text-[#F47920] hover:text-[#e06810] py-2 rounded-lg bg-[#F47920]/10 hover:bg-[#F47920]/15 transition"
              >
                Top up credits <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Quick actions */}
          <div className="surface-premium p-5">
            <h2 className="text-headline text-white mb-3">Quick Add</h2>
            <div className="space-y-1.5">
              {QUICK_ADD.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-slate-300 hover:text-white text-xs font-medium transition group"
                >
                  <span className="flex items-center gap-2.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
                    {item.label}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#F47920] group-hover:translate-x-0.5 transition" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
