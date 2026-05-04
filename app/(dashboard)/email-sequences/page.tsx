'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Mail, Plus, Play, Pause, Square } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import StatusPill, { pillToneForStatus } from '@/components/ui/StatusPill'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import Select from '@/components/ui/Select'

type Seq = {
  id: string; name: string; description: string; status: string
  created_at: string; updated_at: string
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft:    null,
  active:   <Play className="w-3 h-3" />,
  paused:   <Pause className="w-3 h-3" />,
  archived: <Square className="w-3 h-3" />,
}

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Seq[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  const fetchSeq = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      const res = await fetch(`/api/email-sequences?${params}`)
      const data = await res.json()
      setSequences(data.data ?? [])
    } finally { setLoading(false) }
  }, [status])

  useEffect(() => { fetchSeq() }, [fetchSeq])

  return (
    <div className="p-6 mx-auto max-w-7xl">
      <PageHeader
        kicker="Marketing"
        title="Email Sequences"
        subtitle={`${sequences.length} drip campaigns`}
        actions={<Button href="/email-sequences/new" icon={<Plus className="w-4 h-4" />}>New Sequence</Button>}
      />

      <div className="flex gap-3 mb-4">
        <div className="w-44">
          <Select value={status} onValueChange={setStatus} placeholder="All statuses" allowClear clearLabel="All statuses"
            options={['draft', 'active', 'paused', 'archived'].map(s => ({ value: s, label: s }))} />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map(i => <Skeleton key={i} variant="card" />)}
        </div>
      ) : sequences.length === 0 ? (
        <div className="surface-premium">
          <EmptyState icon={<Mail className="w-7 h-7" />} title="No sequences yet"
            description="Build a drip campaign to nurture leads or onboard customers automatically."
            actionLabel="New Sequence" actionHref="/email-sequences/new" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sequences.map((s, idx) => (
            <Link key={s.id} href={`/email-sequences/${s.id}`}
              className="surface-premium hover-lift p-5 transition group anim-rise hover:border-[#F47920]/30"
              style={{ animationDelay: `${Math.min(idx * 30, 200)}ms` }}>
              <div className="flex items-start justify-between mb-3">
                <StatusPill tone={pillToneForStatus(s.status)} size="sm" icon={STATUS_ICONS[s.status]} className="capitalize" uppercase={false}>
                  {s.status}
                </StatusPill>
              </div>
              <h3 className="text-white font-semibold text-sm group-hover:text-[#F47920] transition leading-snug">{s.name}</h3>
              {s.description && <p className="text-slate-500 text-xs mt-1.5 line-clamp-2">{s.description}</p>}
              <p className="text-slate-600 text-[10px] mt-3 tabular-nums">Updated {new Date(s.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
