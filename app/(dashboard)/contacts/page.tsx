'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { UserCircle, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'

type Contact = {
  id: string; first_name: string; last_name: string; email: string
  phone: string; job_title: string; department: string; lead_status: string
  crm_users: { full_name: string } | null
  crm_accounts: { name: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400', contacted: 'bg-purple-500/20 text-purple-400',
  qualified: 'bg-emerald-500/20 text-emerald-400', converted: 'bg-orange-500/20 text-orange-400',
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (search) params.set('search', search)
      const res = await fetch(`/api/contacts?${params}`)
      const data = await res.json()
      setContacts(data.data ?? [])
      setCount(data.count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { setPage(1) }, [search])
  useEffect(() => { fetchContacts() }, [fetchContacts])

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="p-6">
      <PageHeader
        title="Contacts"
        subtitle={`${count} total`}
        actions={
          <Link href="/contacts/new" className="flex items-center gap-1.5 bg-[#F47920] hover:bg-[#e06810] text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
            <Plus className="w-4 h-4" /> New Contact
          </Link>
        }
      />

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text" placeholder="Search contacts…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#0D1B2E] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#F47920]/60 transition"
          />
        </div>
      </div>

      <div className="bg-[#0D1B2E] border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold">Name</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Account</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Job Title</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Status</th>
              <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Assigned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-4 bg-white/5 rounded animate-pulse" /></td></tr>
            )) : contacts.length === 0 ? (
              <tr><td colSpan={5}>
                <EmptyState icon={<UserCircle className="w-7 h-7" />} title="No contacts yet" description="Add contacts to start building relationships." actionLabel="Add Contact" actionHref="/contacts/new" />
              </td></tr>
            ) : contacts.map(c => (
              <tr key={c.id} className="hover:bg-white/3 transition group">
                <td className="px-4 py-3">
                  <Link href={`/contacts/${c.id}`} className="block">
                    <p className="text-white font-medium group-hover:text-[#F47920] transition">{c.first_name} {c.last_name ?? ''}</p>
                    <p className="text-slate-500 text-xs">{c.email ?? c.phone ?? '—'}</p>
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-300 hidden md:table-cell">{c.crm_accounts?.name ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">{c.job_title ?? '—'}</td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  {c.lead_status && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[c.lead_status] ?? 'bg-slate-500/20 text-slate-400'}`}>
                      {c.lead_status}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden xl:table-cell">{c.crm_users?.full_name ?? '—'}</td>
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
