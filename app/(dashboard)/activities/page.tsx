'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { CalendarCheck, Plus, Search, CheckCircle2, Clock, X } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type Activity = {
  id: string; activity_type: string; subject: string; description: string
  status: string; due_date: string; completed_at: string
  related_to_type: string; related_to_id: string
  crm_users: { full_name: string } | null
}

const TYPE_ICONS: Record<string, string> = {
  call: '📞', email: '✉️', meeting: '🤝', task: '✅',
  note: '📝', demo: '🖥️', follow_up: '🔔',
}

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  cancelled: 'bg-red-500/20 text-red-400',
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const fetchActivities = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (status) params.set('status', status)
      const res = await fetch(`/api/activities?${params}`)
      const data = await res.json()
      setActivities(data.data ?? [])
      setCount(data.count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => { setPage(1) }, [status])
  useEffect(() => { fetchActivities() }, [fetchActivities])

  async function markComplete(id: string) {
    const res = await fetch(`/api/activities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    if (res.ok) {
      toast.success('Marked as complete!')
      fetchActivities()
    } else {
      toast.error('Failed to update.')
    }
  }

  const isOverdue = (due: string) => due && new Date(due) < new Date() && status === 'pending'

  return (
    <div className="p-6">
      <PageHeader
        title="Activities"
        subtitle={`${count} ${status || 'total'}`}
        actions={
          <Link href="/activities/new" className="flex items-center gap-1.5 bg-[#F47920] hover:bg-[#e06810] text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
            <Plus className="w-4 h-4" /> Log Activity
          </Link>
        }
      />

      <div className="flex gap-2 mb-4">
        {['pending','completed',''].map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition',
              status === s ? 'bg-[#F47920]/20 text-[#F47920] border border-[#F47920]/40' : 'bg-white/5 text-slate-400 hover:bg-white/10'
            )}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading ? Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 bg-[#0D1B2E] border border-white/5 rounded-xl animate-pulse" />
        )) : activities.length === 0 ? (
          <EmptyState icon={<CalendarCheck className="w-7 h-7" />} title="No activities" description="Log calls, meetings, tasks and follow-ups here." actionLabel="Log Activity" actionHref="/activities/new" />
        ) : activities.map(a => (
          <div key={a.id} className={clsx('flex items-center gap-3 bg-[#0D1B2E] border rounded-xl px-4 py-3 transition', isOverdue(a.due_date) ? 'border-red-500/30' : 'border-white/5 hover:border-white/10')}>
            <span className="text-xl shrink-0">{TYPE_ICONS[a.activity_type] ?? '📋'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{a.subject}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {a.due_date && (
                  <span className={clsx('flex items-center gap-1 text-xs', isOverdue(a.due_date) ? 'text-red-400' : 'text-slate-500')}>
                    <Clock className="w-3 h-3" />
                    {new Date(a.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {a.crm_users?.full_name && <span className="text-slate-600 text-xs">· {a.crm_users.full_name}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[a.status] ?? ''}`}>
                {a.status}
              </span>
              {a.status === 'pending' && (
                <button
                  onClick={() => markComplete(a.id)}
                  className="w-7 h-7 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center justify-center text-emerald-400 transition"
                  title="Mark complete"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
