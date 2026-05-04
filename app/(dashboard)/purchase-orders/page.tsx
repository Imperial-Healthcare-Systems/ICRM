'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ShoppingCart, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import StatusPill, { pillToneForStatus } from '@/components/ui/StatusPill'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import clsx from 'clsx'

type PO = {
  id: string; po_number: string; status: string
  issue_date: string; expected_delivery: string
  total: number; currency: string; created_at: string
  crm_vendors: { name: string } | null
}

export default function PurchaseOrdersPage() {
  const [pos, setPos] = useState<PO[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const fetchPos = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (status) params.set('status', status)
      const res = await fetch(`/api/purchase-orders?${params}`)
      const data = await res.json()
      setPos(data.data ?? [])
      setCount(data.count ?? 0)
    } finally { setLoading(false) }
  }, [page, status])

  useEffect(() => { setPage(1) }, [status])
  useEffect(() => { fetchPos() }, [fetchPos])

  const fmt = (n: number, currency = 'INR') =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="p-6 mx-auto max-w-7xl">
      <PageHeader
        kicker="Finance"
        title="Purchase Orders"
        subtitle={`${count} total`}
        actions={<Button href="/purchase-orders/new" icon={<Plus className="w-4 h-4" />}>New PO</Button>}
      />

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {['', 'draft', 'sent', 'confirmed', 'received', 'cancelled'].map(s => (
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
              <th className="text-left px-4 py-3 font-semibold">PO #</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Vendor</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Status</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Expected Delivery</th>
              <th className="text-right px-4 py-3 font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={5} className="px-4 py-3"><Skeleton variant="text" className="h-3" /></td></tr>
            )) : pos.length === 0 ? (
              <tr><td colSpan={5}>
                <EmptyState icon={<ShoppingCart className="w-7 h-7" />} title="No purchase orders yet"
                  description="Create purchase orders to manage procurement."
                  actionLabel="New PO" actionHref="/purchase-orders/new" />
              </td></tr>
            ) : pos.map((po, idx) => (
              <tr key={po.id} className="hover:bg-white/[0.02] transition group anim-rise" style={{ animationDelay: `${Math.min(idx * 15, 200)}ms` }}>
                <td className="px-4 py-3">
                  <Link href={`/purchase-orders/${po.id}`} className="block">
                    <p className="text-white font-medium group-hover:text-[#F47920] transition tabular-nums">{po.po_number}</p>
                    <p className="text-slate-500 text-xs mt-0.5 tabular-nums">{new Date(po.issue_date).toLocaleDateString('en-IN')}</p>
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-300 hidden md:table-cell">{po.crm_vendors?.name ?? '—'}</td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <StatusPill tone={pillToneForStatus(po.status)} size="sm" uppercase={false} className="capitalize">{po.status}</StatusPill>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell tabular-nums">
                  {po.expected_delivery ? new Date(po.expected_delivery).toLocaleDateString('en-IN') : '—'}
                </td>
                <td className="px-4 py-3 text-right text-[#F47920] font-bold tabular-nums">{fmt(po.total, po.currency)}</td>
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
