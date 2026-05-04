'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  CalendarDays, ChevronLeft, ChevronRight,
  CheckSquare, MapPin, FileText, ScrollText, TrendingUp, CalendarCheck,
} from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import clsx from 'clsx'

type CalEvent = {
  id: string
  source: 'activity' | 'field_visit' | 'task' | 'invoice' | 'contract' | 'deal' | 'project'
  title: string
  date: string
  status?: string
  href: string
  badge?: string
  color?: string
}

const ICONS: Record<CalEvent['source'], React.ReactNode> = {
  activity:    <CalendarCheck className="w-3 h-3" />,
  field_visit: <MapPin className="w-3 h-3" />,
  task:        <CheckSquare className="w-3 h-3" />,
  invoice:     <FileText className="w-3 h-3" />,
  contract:    <ScrollText className="w-3 h-3" />,
  deal:        <TrendingUp className="w-3 h-3" />,
  project:     <CalendarDays className="w-3 h-3" />,
}

const COLOR_MAP: Record<string, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  blue:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  purple:  'bg-purple-500/15 text-purple-400 border-purple-500/30',
  orange:  'bg-orange-500/15 text-orange-400 border-orange-500/30',
  yellow:  'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  red:     'bg-red-500/15 text-red-400 border-red-500/30',
  slate:   'bg-slate-500/15 text-slate-400 border-slate-500/30',
}

export default function CalendarPage() {
  const [cursor, setCursor] = useState(new Date())
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)

  const monthStart = useMemo(() => {
    const d = new Date(cursor); d.setDate(1); d.setHours(0, 0, 0, 0); return d
  }, [cursor])
  const monthEnd = useMemo(() => {
    const d = new Date(monthStart); d.setMonth(d.getMonth() + 1); d.setDate(0); return d
  }, [monthStart])

  useEffect(() => {
    const from = monthStart.toISOString().split('T')[0]
    const to = monthEnd.toISOString().split('T')[0]
    setLoading(true)
    fetch(`/api/calendar?from=${from}&to=${to}`)
      .then(r => r.json())
      .then(d => { setEvents(d.data ?? []) })
      .finally(() => setLoading(false))
  }, [monthStart, monthEnd])

  // Build calendar grid (6 rows × 7 cols)
  const firstDay = monthStart.getDay() // 0 = Sunday
  const daysInMonth = monthEnd.getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), d))
  while (cells.length < 42) cells.push(null)

  // Group events by day
  const eventsByDay = useMemo(() => {
    const map: Record<string, CalEvent[]> = {}
    for (const e of events) {
      const day = e.date.slice(0, 10)
      if (!map[day]) map[day] = []
      map[day].push(e)
    }
    return map
  }, [events])

  const today = new Date(); today.setHours(0, 0, 0, 0)

  return (
    <div className="p-6">
      <PageHeader
        title="Calendar"
        subtitle={`${events.length} events this month`}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setCursor(new Date())} className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition">Today</button>
            <div className="flex items-center gap-1 bg-white/5 rounded-lg">
              <button onClick={() => setCursor(c => { const d = new Date(c); d.setMonth(d.getMonth() - 1); return d })} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-white font-semibold text-sm px-3 min-w-[140px] text-center">
                {cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={() => setCursor(c => { const d = new Date(c); d.setMonth(d.getMonth() + 1); return d })} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        }
      />

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider text-center py-2">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} className="bg-[#0D1B2E]/40 rounded-lg min-h-[110px]" />
          const key = cell.toISOString().split('T')[0]
          const dayEvents = eventsByDay[key] ?? []
          const isToday = cell.getTime() === today.getTime()
          const isPast = cell < today
          return (
            <div key={i} className={clsx(
              'bg-[#0D1B2E] border rounded-lg min-h-[110px] p-1.5 flex flex-col gap-1',
              isToday ? 'border-[#F47920]/60' : 'border-white/5',
              isPast && !isToday && 'opacity-60',
            )}>
              <div className="flex items-center justify-between">
                <span className={clsx('text-xs font-bold', isToday ? 'text-[#F47920]' : 'text-slate-300')}>
                  {cell.getDate()}
                </span>
                {dayEvents.length > 3 && <span className="text-[9px] text-slate-500">+{dayEvents.length - 3}</span>}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(e => (
                  <Link key={`${e.source}-${e.id}`} href={e.href}
                    className={clsx(
                      'block text-[10px] px-1.5 py-0.5 rounded border truncate hover:opacity-80 transition',
                      COLOR_MAP[e.color ?? 'slate']
                    )} title={e.title}>
                    <span className="inline-flex items-center gap-1">
                      {ICONS[e.source]}
                      <span className="truncate">{e.title}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Upcoming list (sidebar-style summary) */}
      <div className="mt-6 bg-[#0D1B2E] border border-white/5 rounded-xl p-5">
        <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
          <CalendarDays className="w-4 h-4" /> Upcoming
        </h3>
        {loading ? <div className="h-24 bg-white/3 rounded animate-pulse" /> :
          events.filter(e => new Date(e.date) >= today).slice(0, 8).length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">No upcoming events.</p>
          ) : (
            <div className="space-y-2">
              {events.filter(e => new Date(e.date) >= today).slice(0, 8).map(e => (
                <Link key={`${e.source}-${e.id}`} href={e.href}
                  className="flex items-center gap-3 hover:bg-white/3 -mx-2 px-2 py-1.5 rounded-lg transition">
                  <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center border', COLOR_MAP[e.color ?? 'slate'])}>
                    {ICONS[e.source]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{e.title}</p>
                    <p className="text-slate-500 text-[10px] capitalize">{e.source.replace('_', ' ')} · {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  </div>
                </Link>
              ))}
            </div>
          )
        }
      </div>
    </div>
  )
}
