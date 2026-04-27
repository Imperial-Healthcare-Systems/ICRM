import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import {
  Star, UserCircle, Building2, TrendingUp,
  TicketCheck, CalendarCheck, Brain, AlertTriangle,
} from 'lucide-react'

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

const STATUS_COLORS: Record<string, string> = {
  open:    'bg-blue-500/20 text-blue-400',
  won:     'bg-emerald-500/20 text-emerald-400',
  lost:    'bg-red-500/20 text-red-400',
  on_hold: 'bg-yellow-500/20 text-yellow-400',
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const { orgId } = session.user
  const [stats, recentDeals] = await Promise.all([
    getDashboardStats(orgId),
    getRecentDeals(orgId),
  ])

  const STAT_CARDS = [
    { label: 'New Leads',          value: stats.newLeads,              icon: <Star className="w-5 h-5" />,         color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'Contacts',           value: stats.contacts,              icon: <UserCircle className="w-5 h-5" />,   color: 'text-blue-400',   bg: 'bg-blue-500/10' },
    { label: 'Accounts',           value: stats.accounts,              icon: <Building2 className="w-5 h-5" />,    color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'Open Pipeline',      value: fmt(stats.openDealsValue),   icon: <TrendingUp className="w-5 h-5" />,   color: 'text-emerald-400',bg: 'bg-emerald-500/10' },
    { label: 'Open Tickets',       value: stats.openTickets,           icon: <TicketCheck className="w-5 h-5" />,  color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { label: 'Pending Tasks',      value: stats.pendingActivities,     icon: <CalendarCheck className="w-5 h-5" />,color: 'text-pink-400',   bg: 'bg-pink-500/10' },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-white font-bold text-xl">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
          {session.user.name?.split(' ')[0] ?? 'there'} 👋
        </h1>
        <p className="text-slate-400 text-sm mt-1">Here&apos;s what&apos;s happening across your CRM today.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {STAT_CARDS.map(card => (
          <div key={card.label} className="bg-[#0D1B2E] border border-white/5 rounded-xl p-4">
            <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center ${card.color} mb-3`}>
              {card.icon}
            </div>
            <p className="text-2xl font-bold text-white">{card.value}</p>
            <p className="text-slate-400 text-xs mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Recent deals */}
        <div className="xl:col-span-2 bg-[#0D1B2E] border border-white/5 rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h2 className="text-white font-semibold text-sm">Recent Deals</h2>
            <a href="/deals" className="text-[#F47920] text-xs hover:underline">View all</a>
          </div>
          <div className="divide-y divide-white/5">
            {recentDeals.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No deals yet. <a href="/deals" className="text-[#F47920] hover:underline">Create your first deal →</a></p>
            ) : recentDeals.map((deal: any) => (
              <div key={deal.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{deal.title}</p>
                  <p className="text-slate-400 text-xs truncate">
                    {(deal.crm_accounts as any)?.name ?? 'No account'}{' '}
                    {deal.expected_close ? `· Closes ${new Date(deal.expected_close).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-white text-sm font-semibold">{fmt(Number(deal.deal_value))}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[deal.deal_status] ?? 'bg-slate-500/20 text-slate-400'}`}>
                    {deal.deal_status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Credits + Quick actions */}
        <div className="space-y-4">
          {/* Credits */}
          <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-[#F47920]" />
              <h2 className="text-white font-semibold text-sm">Imperial Intelligence</h2>
            </div>
            <p className="text-3xl font-bold text-white">{stats.credits.toLocaleString()}</p>
            <p className="text-slate-400 text-xs mt-0.5">AI credits remaining</p>
            {stats.credits < 20 && (
              <div className="mt-3 flex items-center gap-1.5 text-yellow-400 text-xs bg-yellow-500/10 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                Credits running low
              </div>
            )}
            <a href="/settings/billing" className="mt-3 block text-center text-xs text-[#F47920] hover:underline">
              Top up credits →
            </a>
          </div>

          {/* Quick actions */}
          <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-5">
            <h2 className="text-white font-semibold text-sm mb-3">Quick Add</h2>
            <div className="space-y-2">
              {[
                { label: 'New Lead',     href: '/leads/new' },
                { label: 'New Contact',  href: '/contacts/new' },
                { label: 'New Deal',     href: '/deals/new' },
                { label: 'Log Activity', href: '/activities/new' },
              ].map(item => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/8 text-slate-300 hover:text-white text-xs font-medium transition"
                >
                  {item.label}
                  <span className="text-slate-500">→</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
