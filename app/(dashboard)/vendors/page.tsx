'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Truck, Plus, ChevronLeft, ChevronRight, Globe, Phone } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'

type Vendor = {
  id: string; name: string; email: string; phone: string
  category: string; status: string; website: string
  contact_name: string; created_at: string
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 20

  const fetchVendors = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      const res = await fetch(`/api/vendors?${params}`)
      const data = await res.json()
      setVendors(data.data ?? [])
      setCount(data.count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchVendors() }, [fetchVendors])

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="p-6">
      <PageHeader
        title="Vendors"
        subtitle={`${count} total`}
        actions={
          <Link href="/vendors/new" className="flex items-center gap-1.5 bg-[#F47920] hover:bg-[#e06810] text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
            <Plus className="w-4 h-4" /> Add Vendor
          </Link>
        }
      />

      <div className="bg-[#0D1B2E] border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold">Vendor</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Category</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Contact</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Status</th>
              <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Website</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-4 bg-white/5 rounded animate-pulse" /></td></tr>
            )) : vendors.length === 0 ? (
              <tr><td colSpan={5}>
                <EmptyState icon={<Truck className="w-7 h-7" />} title="No vendors yet" description="Add vendors to manage procurement and purchase orders." actionLabel="Add Vendor" actionHref="/vendors/new" />
              </td></tr>
            ) : vendors.map(v => (
              <tr key={v.id} className="hover:bg-white/3 transition group">
                <td className="px-4 py-3">
                  <Link href={`/vendors/${v.id}`} className="block">
                    <p className="text-white font-medium group-hover:text-[#F47920] transition">{v.name}</p>
                    {v.email && <p className="text-slate-500 text-xs">{v.email}</p>}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-300 text-xs hidden md:table-cell capitalize">{v.category ?? '—'}</td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="text-slate-300 text-xs">
                    {v.contact_name && <p>{v.contact_name}</p>}
                    {v.phone && <p className="flex items-center gap-1 text-slate-500"><Phone className="w-3 h-3" />{v.phone}</p>}
                  </div>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${v.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                    {v.status ?? 'active'}
                  </span>
                </td>
                <td className="px-4 py-3 hidden xl:table-cell">
                  {v.website ? (
                    <a href={v.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs transition">
                      <Globe className="w-3 h-3" /> Website
                    </a>
                  ) : <span className="text-slate-600 text-xs">—</span>}
                </td>
              </tr>
            ))}
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
