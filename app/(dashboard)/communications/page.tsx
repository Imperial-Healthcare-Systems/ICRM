'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  Phone, Calendar, Mail, StickyNote, ListTodo, Megaphone, MessageSquare,
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight,
} from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import clsx from 'clsx'

type Comm = {
  id: string
  channel: 'call' | 'meeting' | 'email' | 'note' | 'task' | 'campaign'
  direction: 'in' | 'out' | 'internal'
  subject: string
  body: string
  contact_id: string | null
  contact_name: string | null
  account_id: string | null
  user_id: string | null
  user_name: string | null
  status: string | null
  occurred_at: string
}

const CHANNEL_META: Record<Comm['channel'], { icon: React.ReactNode; ring: string; pill: string; label: string }> = {
  call:     { icon: <Phone className="w-3.5 h-3.5" />,        ring: 'ring-blue-500/40 bg-blue-500/15 text-blue-400',         pill: 'bg-blue-500/15 text-blue-400',         label: 'Call' },
  meeting:  { icon: <Calendar className="w-3.5 h-3.5" />,     ring: 'ring-purple-500/40 bg-purple-500/15 text-purple-400',   pill: 'bg-purple-500/15 text-purple-400',     label: 'Meeting' },
  email:    { icon: <Mail className="w-3.5 h-3.5" />,         ring: 'ring-emerald-500/40 bg-emerald-500/15 text-emerald-400',pill: 'bg-emerald-500/15 text-emerald-400',   label: 'Email' },
  task:     { icon: <ListTodo className="w-3.5 h-3.5" />,     ring: 'ring-yellow-500/40 bg-yellow-500/15 text-yellow-400',   pill: 'bg-yellow-500/15 text-yellow-400',     label: 'Task' },
  note:     { icon: <StickyNote className="w-3.5 h-3.5" />,   ring: 'ring-slate-500/40 bg-slate-500/15 text-slate-300',      pill: 'bg-slate-500/15 text-slate-300',       label: 'Note' },
  campaign: { icon: <Megaphone className="w-3.5 h-3.5" />,    ring: 'ring-[#F47920]/40 bg-[#F47920]/15 text-[#F47920]',      pill: 'bg-[#F47920]/15 text-[#F47920]',       label: 'Campaign' },
}

const FILTERS: { key: string; label: string; icon?: React.ReactNode }[] = [
  { key: '',         label: 'All',      icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
  { key: 'call',     label: 'Calls',    icon: <Phone className="w-3.5 h-3.5" /> },
  { key: 'meeting',  label: 'Meetings', icon: <Calendar className="w-3.5 h-3.5" /> },
  { key: 'email',    label: 'Emails',   icon: <Mail className="w-3.5 h-3.5" /> },
  { key: 'task',     label: 'Tasks',    icon: <ListTodo className="w-3.5 h-3.5" /> },
  { key: 'note',     label: 'Notes',    icon: <StickyNote className="w-3.5 h-3.5" /> },
  { key: 'campaign', label: 'Campaigns',icon: <Megaphone className="w-3.5 h-3.5" /> },
]

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

function bucketOf(date: Date) {
  const today = startOfDay(new Date()).getTime()
  const day = startOfDay(date).getTime()
  const diff = (today - day) / 86_400_000
  if (diff === 0)            return 'Today'
  if (diff === 1)            return 'Yesterday'
  if (diff > 1 && diff <= 7) return 'This week'
  if (diff > 7 && diff <= 30) return 'This month'
  return 'Earlier'
}

const BUCKET_ORDER = ['Today', 'Yesterday', 'This week', 'This month', 'Earlier']

export default function CommunicationsPage() {
  const [items, setItems] = useState<Comm[]>([])
  const [loading, setLoading] = useState(true)
  const [channel, setChannel] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '150' })
      if (channel) params.set('channel', channel)
      const res = await fetch(`/api/communications?${params}`)
      const data = await res.json()
      setItems(data.data ?? [])
    } finally { setLoading(false) }
  }, [channel])

  useEffect(() => { fetchAll() }, [fetchAll])

  const totals = useMemo(() => {
    const t: Record<string, number> = { call: 0, meeting: 0, email: 0, task: 0, note: 0, campaign: 0 }
    for (const c of items) t[c.channel] = (t[c.channel] ?? 0) + 1
    return t
  }, [items])

  const groups = useMemo(() => {
    const map: Record<string, Comm[]> = {}
    for (const c of items) {
      const b = bucketOf(new Date(c.occurred_at))
      ;(map[b] ??= []).push(c)
    }
    return BUCKET_ORDER.filter(b => map[b]?.length).map(b => ({ bucket: b, items: map[b] }))
  }, [items])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        kicker="Engagement"
        title="Communications"
        subtitle={`${items.length} interactions across all channels`}
      />

      {/* Channel summary strip */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-5">
        {(['call', 'meeting', 'email', 'task', 'note', 'campaign'] as const).map(ch => {
          const meta = CHANNEL_META[ch]
          return (
            <button key={ch} onClick={() => setChannel(channel === ch ? '' : ch)}
              className={clsx(
                'bg-[#0D1B2E] border rounded-xl p-3 text-left transition group',
                channel === ch ? 'border-[#F47920]/40' : 'border-white/5 hover:border-white/15'
              )}>
              <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center mb-2', meta.pill)}>
                {meta.icon}
              </div>
              <p className="text-white font-bold text-lg tabular-nums leading-none">{totals[ch]}</p>
              <p className="text-slate-500 text-[10px] uppercase tracking-wider mt-1">{meta.label}</p>
            </button>
          )
        })}
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setChannel(f.key)}
            className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5',
              channel === f.key
                ? 'bg-[#F47920]/15 text-[#F47920] ring-1 ring-[#F47920]/40'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200')}>
            {f.icon}
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <Skeleton key={i} variant="row" className="bg-[#0D1B2E] border border-white/5 rounded-xl h-20" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="surface-premium">
          <EmptyState icon={<MessageSquare className="w-7 h-7" />} title="No interactions yet"
            description="Calls, meetings, emails, notes and broadcasts will appear here as your team logs them across the CRM." />
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(({ bucket, items: bucketItems }) => (
            <section key={bucket}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.15em]">{bucket}</h2>
                <span className="text-slate-600 text-xs tabular-nums">{bucketItems.length}</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              <div className="relative pl-7">
                <div className="absolute left-3 top-1 bottom-1 w-px bg-gradient-to-b from-white/15 via-white/5 to-transparent" />
                <div className="space-y-2.5">
                  {bucketItems.map((c, idx) => {
                    const meta = CHANNEL_META[c.channel] ?? CHANNEL_META.note
                    return (
                      <div key={`${c.channel}-${c.id}`} className="relative group anim-rise"
                           style={{ animationDelay: `${Math.min(idx * 25, 200)}ms` }}>
                        <div className={clsx('absolute -left-7 top-3 w-6 h-6 rounded-full ring-2 ring-[#07111F] flex items-center justify-center', meta.ring)}>
                          {meta.icon}
                        </div>
                        <div className="bg-[#0D1B2E] border border-white/5 group-hover:border-white/10 rounded-xl p-4 transition">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className={clsx('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full', meta.pill)}>
                              {meta.label}
                            </span>
                            {c.direction === 'in' && <span title="Inbound" className="text-emerald-400 flex items-center"><ArrowDownLeft className="w-3 h-3" /></span>}
                            {c.direction === 'out' && <span title="Outbound" className="text-blue-400 flex items-center"><ArrowUpRight className="w-3 h-3" /></span>}
                            {c.contact_name && (
                              c.contact_id ? (
                                <Link href={`/contacts/${c.contact_id}`} className="text-slate-200 text-xs font-medium hover:text-[#F47920] transition">
                                  {c.contact_name}
                                </Link>
                              ) : (
                                <span className="text-slate-300 text-xs font-medium">{c.contact_name}</span>
                              )
                            )}
                            {c.status && (
                              <span className="text-slate-500 text-[10px] capitalize before:content-['·'] before:mx-1">{c.status.replace('_', ' ')}</span>
                            )}
                            <span className="ml-auto text-slate-500 text-[10px] tabular-nums">
                              {new Date(c.occurred_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                          {c.subject && <h3 className="text-white text-sm font-semibold mb-1 leading-snug">{c.subject}</h3>}
                          {c.body && <p className="text-slate-400 text-xs whitespace-pre-wrap line-clamp-3 leading-relaxed">{c.body}</p>}
                          {c.user_name && <p className="text-slate-500 text-[10px] mt-2.5">— {c.user_name}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
