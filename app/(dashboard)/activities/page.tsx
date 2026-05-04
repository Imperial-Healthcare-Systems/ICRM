'use client'

import { useEffect, useState, useCallback } from 'react'
import { CalendarCheck, Plus, CheckCircle2, Clock, Phone, Mail, Users, ListTodo, StickyNote, Monitor, Bell } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import StatusPill, { pillToneForStatus } from '@/components/ui/StatusPill'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type Activity = {
  id: string; activity_type: string; subject: string; description: string
  status: string; due_date: string; completed_at: string
  related_to_type: string; related_to_id: string
  crm_users: { full_name: string } | null
}

const TYPE_META: Record<string, { icon: React.ReactNode; tone: string }> = {
  call:      { icon: <Phone className="w-4 h-4" />,      tone: 'text-blue-400 bg-blue-500/10' },
  email:     { icon: <Mail className="w-4 h-4" />,       tone: 'text-emerald-400 bg-emerald-500/10' },
  meeting:   { icon: <Users className="w-4 h-4" />,      tone: 'text-purple-400 bg-purple-500/10' },
  task:      { icon: <ListTodo className="w-4 h-4" />,   tone: 'text-yellow-400 bg-yellow-500/10' },
  note:      { icon: <StickyNote className="w-4 h-4" />, tone: 'text-slate-400 bg-slate-500/10' },
  demo:      { icon: <Monitor className="w-4 h-4" />,    tone: 'text-cyan-400 bg-cyan-500/10' },
  follow_up: { icon: <Bell className="w-4 h-4" />,       tone: 'text-pink-400 bg-pink-500/10' },
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
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
    } finally { setLoading(false) }
  }, [page, status])

  useEffect(() => { setPage(1) }, [status])
  useEffect(() => { fetchActivities() }, [fetchActivities])

  async function markComplete(id: string) {
    const res = await fetch(`/api/activities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    if (res.ok) { toast.success('Marked as complete!'); fetchActivities() }
    else toast.error('Failed to update.')
  }

  const isOverdue = (due: string) => due && new Date(due) < new Date() && status === 'pending'

  return (
    <div className="p-6 mx-auto max-w-5xl">
      <PageHeader
        kicker="Engagement"
        title="Activities"
        subtitle={`${count} ${status || 'total'}`}
        actions={
          <Button href="/activities/new" icon={<Plus className="w-4 h-4" />}>Log Activity</Button>
        }
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {['pending','completed',''].map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition',
              status === s
                ? 'bg-[#F47920]/15 text-[#F47920] ring-1 ring-[#F47920]/40'
                : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
            )}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading ? Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        )) : activities.length === 0 ? (
          <div className="surface-premium">
            <EmptyState icon={<CalendarCheck className="w-7 h-7" />} title="No activities"
              description="Log calls, meetings, tasks and follow-ups here."
              actionLabel="Log Activity" actionHref="/activities/new" />
          </div>
        ) : activities.map((a, idx) => {
          const meta = TYPE_META[a.activity_type] ?? { icon: <ListTodo className="w-4 h-4" />, tone: 'text-slate-400 bg-slate-500/10' }
          const overdue = isOverdue(a.due_date)
          return (
            <div key={a.id}
                 className={clsx(
                   'surface-premium hover-lift flex items-center gap-3 px-4 py-3.5 transition anim-rise',
                   overdue && 'border-red-500/30 bg-gradient-to-r from-red-500/5 to-transparent',
                 )}
                 style={{ animationDelay: `${Math.min(idx * 20, 200)}ms` }}>
              <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', meta.tone)}>
                {meta.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{a.subject}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {a.due_date && (
                    <span className={clsx('flex items-center gap-1 text-xs', overdue ? 'text-red-400 font-semibold' : 'text-slate-500')}>
                      <Clock className="w-3 h-3" />
                      <span className="tabular-nums">{new Date(a.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      {overdue && <span className="text-[10px] uppercase tracking-wider">Overdue</span>}
                    </span>
                  )}
                  {a.crm_users?.full_name && <span className="text-slate-600 text-xs">· {a.crm_users.full_name}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusPill tone={pillToneForStatus(a.status)} size="xs" uppercase={false} className="capitalize">{a.status}</StatusPill>
                {a.status === 'pending' && (
                  <button
                    onClick={() => markComplete(a.id)}
                    className="w-8 h-8 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center justify-center text-emerald-400 transition"
                    title="Mark complete"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
