'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Mail, Plus, ChevronLeft, ChevronRight, Send, Users, Eye, MousePointer } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import clsx from 'clsx'

type Campaign = {
  id: string; name: string; type: string; status: string; subject: string
  scheduled_at: string; sent_at: string; created_at: string
  recipient_count: number; open_count: number; click_count: number
}

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-slate-500/20 text-slate-400',
  scheduled: 'bg-blue-500/20 text-blue-400',
  sending:   'bg-yellow-500/20 text-yellow-400',
  sent:      'bg-emerald-500/20 text-emerald-400',
  paused:    'bg-orange-500/20 text-orange-400',
  cancelled: 'bg-red-500/20 text-red-400',
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const fetchCampaigns = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (status) params.set('status', status)
      if (type) params.set('type', type)
      const res = await fetch(`/api/campaigns?${params}`)
      const data = await res.json()
      setCampaigns(data.data ?? [])
      setCount(data.count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, status, type])

  useEffect(() => { setPage(1) }, [status, type])
  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="p-6">
      <PageHeader
        title="Campaigns"
        subtitle={`${count} total`}
        actions={
          <Link href="/campaigns/new" className="flex items-center gap-1.5 bg-[#F47920] hover:bg-[#e06810] text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
            <Plus className="w-4 h-4" /> New Campaign
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex gap-1">
          {['', 'draft', 'scheduled', 'sent', 'paused', 'cancelled'].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize',
                status === s ? 'bg-[#F47920]/20 text-[#F47920] border border-[#F47920]/40' : 'bg-white/5 text-slate-400 hover:bg-white/10')}>
              {s === '' ? 'All' : s}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {['', 'email', 'whatsapp', 'sms'].map(t => (
            <button key={t} onClick={() => setType(t)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize',
                type === t ? 'bg-[#F47920]/20 text-[#F47920] border border-[#F47920]/40' : 'bg-white/5 text-slate-400 hover:bg-white/10')}>
              {t === '' ? 'All Types' : t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#0D1B2E] border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold">Campaign</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Status</th>
              <th className="text-right px-4 py-3 font-semibold hidden lg:table-cell">Recipients</th>
              <th className="text-right px-4 py-3 font-semibold hidden lg:table-cell">Opens</th>
              <th className="text-right px-4 py-3 font-semibold hidden xl:table-cell">Clicks</th>
              <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Sent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-4 bg-white/5 rounded animate-pulse" /></td></tr>
            )) : campaigns.length === 0 ? (
              <tr><td colSpan={6}>
                <EmptyState icon={<Mail className="w-7 h-7" />} title="No campaigns yet" description="Create email or WhatsApp campaigns to engage your clients." actionLabel="New Campaign" actionHref="/campaigns/new" />
              </td></tr>
            ) : campaigns.map(c => {
              const openRate = c.recipient_count > 0 ? ((c.open_count / c.recipient_count) * 100).toFixed(1) : '—'
              const clickRate = c.recipient_count > 0 ? ((c.click_count / c.recipient_count) * 100).toFixed(1) : '—'
              return (
                <tr key={c.id} className="hover:bg-white/3 transition group">
                  <td className="px-4 py-3">
                    <Link href={`/campaigns/${c.id}`} className="block">
                      <p className="text-white font-medium group-hover:text-[#F47920] transition">{c.name}</p>
                      <p className="text-slate-500 text-xs">{c.type.toUpperCase()} · {c.subject ?? 'No subject'}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[c.status] ?? ''}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell">
                    <span className="flex items-center justify-end gap-1 text-slate-300 text-xs"><Users className="w-3 h-3" />{c.recipient_count.toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell">
                    <span className="flex items-center justify-end gap-1 text-slate-300 text-xs"><Eye className="w-3 h-3" />{openRate}{c.recipient_count > 0 ? '%' : ''}</span>
                  </td>
                  <td className="px-4 py-3 text-right hidden xl:table-cell">
                    <span className="flex items-center justify-end gap-1 text-slate-300 text-xs"><MousePointer className="w-3 h-3" />{clickRate}{c.recipient_count > 0 ? '%' : ''}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden xl:table-cell">
                    {c.sent_at ? new Date(c.sent_at).toLocaleDateString('en-IN') : (c.scheduled_at ? `Scheduled ${new Date(c.scheduled_at).toLocaleDateString('en-IN')}` : '—')}
                  </td>
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
