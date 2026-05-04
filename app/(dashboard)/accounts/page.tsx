'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Building2, Plus, Search, Globe, ChevronLeft, ChevronRight } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import StatusPill from '@/components/ui/StatusPill'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import Avatar from '@/components/ui/Avatar'
import Select from '@/components/ui/Select'

type Account = {
  id: string; name: string; website: string; industry: string
  account_type: string; phone: string; email: string
  annual_revenue: number; employee_count: number
  crm_users: { full_name: string } | null
}

const TYPE_TONE: Record<string, 'emerald' | 'blue' | 'purple' | 'orange' | 'slate'> = {
  customer: 'emerald', prospect: 'blue', partner: 'purple', vendor: 'orange', other: 'slate',
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (search) params.set('search', search)
      if (type) params.set('account_type', type)
      const res = await fetch(`/api/accounts?${params}`)
      const data = await res.json()
      setAccounts(data.data ?? [])
      setCount(data.count ?? 0)
    } finally { setLoading(false) }
  }, [page, search, type])

  useEffect(() => { setPage(1) }, [search, type])
  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  const totalPages = Math.ceil(count / pageSize)
  const fmtRevenue = (n: number) => n >= 10000000 ? `₹${(n/10000000).toFixed(1)}Cr` : n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : n ? `₹${n.toLocaleString('en-IN')}` : '—'

  return (
    <div className="p-6 mx-auto max-w-7xl">
      <PageHeader
        kicker="Sales"
        title="Accounts"
        subtitle={`${count} total`}
        actions={
          <Button href="/accounts/new" icon={<Plus className="w-4 h-4" />}>New Account</Button>
        }
      />

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" placeholder="Search accounts…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#0D1B2E] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#F47920]/60 transition" />
        </div>
        <Select value={type} onValueChange={v => setType(v)} placeholder="All Types" allowClear clearLabel="All Types"
              options={['prospect','customer','partner','vendor','other'].map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))} />
      </div>

      <div className="surface-premium overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold">Account</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Industry</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Type</th>
              <th className="text-right px-4 py-3 font-semibold hidden lg:table-cell">Revenue</th>
              <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Assigned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading ? Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}><td colSpan={5} className="px-4 py-3"><Skeleton variant="text" className="h-3" /></td></tr>
            )) : accounts.length === 0 ? (
              <tr><td colSpan={5}>
                <EmptyState icon={<Building2 className="w-7 h-7" />} title="No accounts yet"
                  description="Create accounts to track companies you work with."
                  actionLabel="Add Account" actionHref="/accounts/new" />
              </td></tr>
            ) : accounts.map((a, idx) => (
              <tr key={a.id} className="hover:bg-white/[0.02] transition group anim-rise" style={{ animationDelay: `${Math.min(idx * 15, 200)}ms` }}>
                <td className="px-4 py-3">
                  <Link href={`/accounts/${a.id}`} className="flex items-center gap-3">
                    <Avatar name={a.name} id={a.id} size="sm" />
                    <div className="min-w-0">
                      <p className="text-white font-medium group-hover:text-[#F47920] transition truncate">{a.name}</p>
                      <div className="flex items-center gap-1 text-slate-500 text-xs mt-0.5 truncate">
                        {a.website && <><Globe className="w-3 h-3" /><span className="truncate">{a.website.replace(/^https?:\/\//, '')}</span></>}
                        {!a.website && a.email && <span className="truncate">{a.email}</span>}
                      </div>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">{a.industry ?? '—'}</td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <StatusPill tone={TYPE_TONE[a.account_type] ?? 'slate'} size="sm" uppercase={false} className="capitalize">
                    {a.account_type}
                  </StatusPill>
                </td>
                <td className="px-4 py-3 text-right text-slate-300 text-sm hidden lg:table-cell tabular-nums">{fmtRevenue(a.annual_revenue)}</td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden xl:table-cell">{a.crm_users?.full_name ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.04]">
            <p className="text-slate-500 text-xs tabular-nums">{count} total · Page {page} of {totalPages}</p>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 flex items-center justify-center text-slate-400 transition"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 flex items-center justify-center text-slate-400 transition"><ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
