'use client'

import { useEffect, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Users, TicketCheck, Star } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import { getChartTheme } from '@/lib/chart-theme'

type Overview = {
  revenueMonth: number; revenueGrowth: number | null
  dealsOpen: number; dealsWonValue: number
  leadsNew: number; ticketsOpen: number; totalContacts: number
}

type RevenuePoint = { month: string; revenue: number; invoices: number }
type StageData = { name: string; count: number; value: number; color: string }
type LeadStatus = { name: string; value: number }

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

function KpiCard({ label, value, sub, icon, positive }: { label: string; value: string; sub?: string; icon: React.ReactNode; positive?: boolean }) {
  return (
    <div className="surface-premium hover-lift p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">{label}</p>
        <div className="w-8 h-8 rounded-lg bg-[#F47920]/10 flex items-center justify-center text-[#F47920]">{icon}</div>
      </div>
      <p className="text-white text-2xl font-bold mb-1">{value}</p>
      {sub && (
        <p className={`text-xs font-medium flex items-center gap-1 ${positive === true ? 'text-emerald-400' : positive === false ? 'text-red-400' : 'text-slate-500'}`}>
          {positive === true && <TrendingUp className="w-3 h-3" />}
          {positive === false && <TrendingDown className="w-3 h-3" />}
          {sub}
        </p>
      )}
    </div>
  )
}

const COLORS = ['#F47920','#3B82F6','#10B981','#8B5CF6','#F59E0B','#EC4899','#06B6D4']

export default function ReportsPage() {
  const { resolvedTheme } = useTheme()
  const ct = getChartTheme(resolvedTheme)
  const tooltipStyle = {
    background: ct.tooltipBg,
    border: `1px solid ${ct.tooltipBorder}`,
    borderRadius: 8,
  }
  const tooltipLabel = { color: ct.tooltipText, fontSize: 12 }
  const tooltipItem  = { color: ct.tooltipText }

  const [overview, setOverview] = useState<Overview | null>(null)
  const [revenue, setRevenue] = useState<RevenuePoint[]>([])
  const [pipeline, setPipeline] = useState<StageData[]>([])
  const [leadsByStatus, setLeadsByStatus] = useState<LeadStatus[]>([])
  const [leadsBySource, setLeadsBySource] = useState<LeadStatus[]>([])
  const [leadSummary, setLeadSummary] = useState<{ total: number; converted: number; conversionRate: string } | null>(null)
  const [pipelineSummary, setPipelineSummary] = useState<{ total: number; won: number; lost: number; winRate: string; totalValue: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/reports/overview').then(r => r.json()),
      fetch('/api/reports/revenue?months=6').then(r => r.json()),
      fetch('/api/reports/pipeline').then(r => r.json()),
      fetch('/api/reports/leads').then(r => r.json()),
    ]).then(([ov, rv, pl, ld]) => {
      setOverview(ov)
      setRevenue(rv.data ?? [])
      setPipeline(pl.stages ?? [])
      setPipelineSummary(pl.summary)
      setLeadsByStatus(ld.byStatus ?? [])
      setLeadsBySource(ld.bySource ?? [])
      setLeadSummary(ld.summary)
      setLoading(false)
    })
  }, [])

  return (
    <div className="p-6 mx-auto max-w-7xl space-y-6">
      <PageHeader kicker="Analytics" title="Reports" subtitle="Business analytics overview" />

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <KpiCard label="Revenue (This Month)" value={overview ? fmt(overview.revenueMonth) : '—'}
          sub={overview?.revenueGrowth != null ? `${overview.revenueGrowth > 0 ? '+' : ''}${overview.revenueGrowth.toFixed(1)}% vs last month` : undefined}
          positive={overview?.revenueGrowth != null ? overview.revenueGrowth >= 0 : undefined}
          icon={<DollarSign className="w-4 h-4" />} />
        <KpiCard label="Won Value (Month)" value={overview ? fmt(overview.dealsWonValue) : '—'}
          icon={<TrendingUp className="w-4 h-4" />} />
        <KpiCard label="Open Deals" value={overview ? String(overview.dealsOpen) : '—'}
          icon={<TrendingUp className="w-4 h-4" />} />
        <KpiCard label="New Leads (Month)" value={overview ? String(overview.leadsNew) : '—'}
          icon={<Star className="w-4 h-4" />} />
        <KpiCard label="Total Contacts" value={overview ? String(overview.totalContacts) : '—'}
          icon={<Users className="w-4 h-4" />} />
        <KpiCard label="Open Tickets" value={overview ? String(overview.ticketsOpen) : '—'}
          icon={<TicketCheck className="w-4 h-4" />} />
        {pipelineSummary && (
          <KpiCard label="Win Rate" value={`${pipelineSummary.winRate}%`}
            sub={`${pipelineSummary.won} won / ${pipelineSummary.lost} lost`}
            positive={parseFloat(pipelineSummary.winRate) >= 30}
            icon={<TrendingUp className="w-4 h-4" />} />
        )}
        {leadSummary && (
          <KpiCard label="Lead Conversion" value={`${leadSummary.conversionRate}%`}
            sub={`${leadSummary.converted} of ${leadSummary.total} leads`}
            positive={parseFloat(leadSummary.conversionRate) >= 10}
            icon={<Star className="w-4 h-4" />} />
        )}
      </div>

      {/* Revenue Chart */}
      <div className="surface-premium p-6">
        <h3 className="text-white font-semibold mb-1">Revenue — Last 6 Months</h3>
        <p className="text-slate-500 text-xs mb-4">Paid invoices by month (INR)</p>
        {loading ? (
          <div className="h-52 bg-white/3 rounded-xl animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenue} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
              <XAxis dataKey="month" tick={{ fill: ct.tickText, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: ct.tickText, fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabel}
                itemStyle={tooltipItem}
                cursor={{ fill: ct.grid }}
                formatter={(v) => [fmt(Number(v ?? 0)), 'Revenue']}
              />
              <Bar dataKey="revenue" fill="#F47920" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline by Stage */}
        <div className="surface-premium p-6">
          <h3 className="text-white font-semibold mb-1">Pipeline by Stage</h3>
          <p className="text-slate-500 text-xs mb-4">Number of deals in each stage</p>
          {loading ? <div className="h-48 bg-white/3 rounded-xl animate-pulse" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pipeline} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} horizontal={false} />
                <XAxis type="number" tick={{ fill: ct.tickText, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fill: ct.tickText, fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabel}
                  itemStyle={tooltipItem}
                  cursor={{ fill: ct.grid }}
                  formatter={(v) => [Number(v ?? 0), 'Deals']}
                />
                <Bar dataKey="count" fill="#F47920" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Leads by Status */}
        <div className="surface-premium p-6">
          <h3 className="text-white font-semibold mb-1">Lead Funnel</h3>
          <p className="text-slate-500 text-xs mb-4">Leads by status</p>
          {loading ? <div className="h-48 bg-white/3 rounded-xl animate-pulse" /> : leadsByStatus.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-600 text-sm">No lead data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={leadsByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} paddingAngle={2}>
                  {leadsByStatus.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value) => <span style={{ color: ct.tickText, fontSize: 11 }}>{value}</span>}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabel}
                  itemStyle={tooltipItem}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Leads by Source */}
      {leadsBySource.length > 0 && (
        <div className="surface-premium p-6">
          <h3 className="text-white font-semibold mb-1">Lead Sources</h3>
          <p className="text-slate-500 text-xs mb-4">Where your leads come from</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={leadsBySource} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
              <XAxis dataKey="name" tick={{ fill: ct.tickText, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: ct.tickText, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabel}
                itemStyle={tooltipItem}
                cursor={{ fill: ct.grid }}
              />
              <Bar dataKey="value" name="Leads" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Revenue trend line */}
      <div className="surface-premium p-6">
        <h3 className="text-white font-semibold mb-1">Revenue Trend</h3>
        <p className="text-slate-500 text-xs mb-4">Month-on-month revenue trajectory</p>
        {loading ? <div className="h-40 bg-white/3 rounded-xl animate-pulse" /> : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={revenue} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
              <XAxis dataKey="month" tick={{ fill: ct.tickText, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: ct.tickText, fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabel}
                itemStyle={tooltipItem}
                cursor={{ stroke: ct.axis }}
                formatter={(v) => [fmt(Number(v ?? 0)), 'Revenue']}
              />
              <Line type="monotone" dataKey="revenue" stroke="#F47920" strokeWidth={2.5} dot={{ fill: '#F47920', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
