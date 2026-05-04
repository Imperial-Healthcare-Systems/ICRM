'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { FileSignature, Plus, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import StatusPill, { pillToneForStatus } from '@/components/ui/StatusPill'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import clsx from 'clsx'

type Contract = {
  id: string; contract_number: string; title: string; contract_type: string
  status: string; start_date: string; end_date: string; value: number
  currency: string; auto_renew: boolean; created_at: string
  crm_accounts: { name: string } | null
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const fetchContracts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (status) params.set('status', status)
      const res = await fetch(`/api/contracts?${params}`)
      const data = await res.json()
      setContracts(data.data ?? [])
      setCount(data.count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => { setPage(1) }, [status])
  useEffect(() => { fetchContracts() }, [fetchContracts])

  const fmt = (n: number, currency = 'INR') =>
    n ? new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n) : '—'

  const totalPages = Math.ceil(count / pageSize)

  const daysToExpiry = (end: string) => {
    const diff = new Date(end).getTime() - Date.now()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  return (
    <div className="p-6 mx-auto max-w-7xl">
      <PageHeader
        kicker="Finance"
        title="Contracts"
        subtitle={`${count} total`}
        actions={
          <Button href="/contracts/new" icon={<Plus className="w-4 h-4" />}>New Contract</Button>
        }
      />

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {['', 'draft', 'active', 'expired', 'terminated', 'renewed'].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize',
              status === s ? 'bg-[#F47920]/15 text-[#F47920] ring-1 ring-[#F47920]/40' : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200')}>
            {s === '' ? 'All' : s}
          </button>
        ))}
      </div>

      <div className="surface-premium overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold">Contract</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Account</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Status</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">End Date</th>
              <th className="text-right px-4 py-3 font-semibold hidden xl:table-cell">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={5} className="px-4 py-3"><Skeleton variant="text" className="h-3" /></td></tr>
            )) : contracts.length === 0 ? (
              <tr><td colSpan={5}>
                <EmptyState icon={<FileSignature className="w-7 h-7" />} title="No contracts yet" description="Manage client contracts and track renewals." actionLabel="New Contract" actionHref="/contracts/new" />
              </td></tr>
            ) : contracts.map(c => {
              const days = c.end_date ? daysToExpiry(c.end_date) : null
              const expiringSoon = days !== null && days <= 30 && days > 0 && c.status === 'active'
              return (
                <tr key={c.id} className="hover:bg-white/3 transition group">
                  <td className="px-4 py-3">
                    <Link href={`/contracts/${c.id}`} className="block">
                      <p className="text-white font-medium group-hover:text-[#F47920] transition">{c.title}</p>
                      <p className="text-slate-500 text-xs">{c.contract_number}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-300 hidden md:table-cell">{c.crm_accounts?.name ?? '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <StatusPill tone={pillToneForStatus(c.status)} size="sm" uppercase={false} className="capitalize">{c.status}</StatusPill>
                      {c.auto_renew && <span title="Auto-renews" className="text-blue-400"><RefreshCw className="w-3 h-3" /></span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <p className={clsx('text-xs', expiringSoon ? 'text-yellow-400 font-semibold' : 'text-slate-400')}>
                      {c.end_date ? new Date(c.end_date).toLocaleDateString('en-IN') : '—'}
                    </p>
                    {expiringSoon && <p className="text-yellow-500 text-[10px]">Expires in {days} days</p>}
                  </td>
                  <td className="px-4 py-3 text-right text-[#F47920] font-bold hidden xl:table-cell">{fmt(c.value, c.currency)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <p className="text-slate-500 text-xs">{count} total · Page {page} of {totalPages}</p>
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
