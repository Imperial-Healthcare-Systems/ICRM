'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { TrendingUp, Plus, LayoutGrid, List } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type Stage = { id: string; name: string; color: string; position: number; probability: number; is_won: boolean; is_lost: boolean }
type Deal = {
  id: string; title: string; deal_value: number; currency: string
  probability: number; deal_status: string; expected_close: string
  stage_id: string
  crm_accounts: { id: string; name: string } | null
  crm_pipeline_stages: Stage | null
  crm_users: { full_name: string } | null
}

function fmtValue(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000)     return `₹${(n / 1000).toFixed(0)}K`
  return `₹${n}`
}

function KanbanCard({ deal, onDragStart }: { deal: Deal; onDragStart: (id: string) => void }) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(deal.id)}
      className="bg-[#0A1628] border border-white/8 rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-white/20 transition group"
    >
      <Link href={`/deals/${deal.id}`} onClick={e => e.stopPropagation()}>
        <p className="text-white text-sm font-medium group-hover:text-[#F47920] transition leading-snug mb-1">{deal.title}</p>
        {deal.crm_accounts && <p className="text-slate-500 text-xs mb-2">{deal.crm_accounts.name}</p>}
        <div className="flex items-center justify-between">
          <span className="text-[#F47920] font-bold text-sm">{fmtValue(Number(deal.deal_value))}</span>
          {deal.expected_close && (
            <span className="text-slate-500 text-[10px]">
              {new Date(deal.expected_close).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      </Link>
    </div>
  )
}

function KanbanColumn({
  stage, deals, onDrop, onDragOver
}: {
  stage: Stage
  deals: Deal[]
  onDrop: (stageId: string) => void
  onDragOver: (e: React.DragEvent) => void
}) {
  const total = deals.reduce((s, d) => s + Number(d.deal_value), 0)
  return (
    <div
      className="flex flex-col min-w-[220px] max-w-[220px]"
      onDrop={() => onDrop(stage.id)}
      onDragOver={onDragOver}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: stage.color }} />
          <span className="text-slate-300 text-xs font-semibold">{stage.name}</span>
          <span className="bg-white/10 text-slate-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{deals.length}</span>
        </div>
      </div>
      {deals.length > 0 && (
        <p className="text-slate-500 text-[10px] px-1 mb-2">{fmtValue(total)}</p>
      )}
      <div className="flex-1 space-y-2 min-h-[80px] rounded-xl p-1 bg-white/3 border border-dashed border-white/10">
        {deals.map(deal => (
          <KanbanCard key={deal.id} deal={deal} onDragStart={() => {}} />
        ))}
      </div>
    </div>
  )
}

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [loading, setLoading] = useState(true)
  const draggingId = useRef<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [dealsRes, stagesRes] = await Promise.all([
        fetch('/api/deals?view=kanban'),
        fetch('/api/pipeline-stages'),
      ])
      const dealsData = await dealsRes.json()
      const stagesData = await stagesRes.json()
      setDeals(dealsData.data ?? [])
      setStages((stagesData.data ?? []).sort((a: Stage, b: Stage) => a.position - b.position))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleDrop(newStageId: string) {
    const id = draggingId.current
    if (!id) return
    const deal = deals.find(d => d.id === id)
    if (!deal || deal.stage_id === newStageId) return

    // Optimistic update
    setDeals(prev => prev.map(d => d.id === id ? { ...d, stage_id: newStageId } : d))

    const stage = stages.find(s => s.id === newStageId)
    const updates: Record<string, unknown> = { stage_id: newStageId, probability: stage?.probability ?? deal.probability }
    if (stage?.is_won) updates.deal_status = 'won'
    if (stage?.is_lost) updates.deal_status = 'lost'

    const res = await fetch(`/api/deals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) {
      toast.error('Failed to move deal.')
      fetchData()
    } else if (stage?.is_won) {
      toast.success('Deal marked as won!')
    }
    draggingId.current = null
  }

  const dealsByStage = (stageId: string) => deals.filter(d => d.stage_id === stageId)
  const totalPipeline = deals.reduce((s, d) => s + Number(d.deal_value), 0)

  return (
    <div className="p-6 flex flex-col h-full mx-auto max-w-[1600px] w-full">
      <PageHeader
        kicker="Sales"
        title="Deals"
        subtitle={`${deals.length} open · ${fmtValue(totalPipeline)} pipeline`}
        actions={
          <>
            <div className="flex bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06]">
              <button onClick={() => setView('kanban')} title="Kanban view"
                className={clsx('p-1.5 rounded-md transition', view === 'kanban' ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:text-slate-300')}>
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setView('list')} title="List view"
                className={clsx('p-1.5 rounded-md transition', view === 'list' ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:text-slate-300')}>
                <List className="w-4 h-4" />
              </button>
            </div>
            <Button href="/deals/new" icon={<Plus className="w-4 h-4" />}>New Deal</Button>
          </>
        }
      />

      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="min-w-[220px] h-64 rounded-xl" />
          ))}
        </div>
      ) : deals.length === 0 && stages.length === 0 ? (
        <EmptyState icon={<TrendingUp className="w-7 h-7" />} title="No deals yet" description="Create your first deal to start tracking your pipeline." actionLabel="New Deal" actionHref="/deals/new" />
      ) : view === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
          {stages.map(stage => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              deals={dealsByStage(stage.id)}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
            />
          ))}
        </div>
      ) : (
        <div className="bg-[#0D1B2E] border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-semibold">Deal</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Account</th>
                <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Stage</th>
                <th className="text-right px-4 py-3 font-semibold">Value</th>
                <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Close Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {deals.map(d => (
                <tr key={d.id} className="hover:bg-white/3 transition group">
                  <td className="px-4 py-3">
                    <Link href={`/deals/${d.id}`} className="text-white font-medium group-hover:text-[#F47920] transition text-sm">{d.title}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">{d.crm_accounts?.name ?? '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {d.crm_pipeline_stages && (
                      <span className="flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full" style={{ background: d.crm_pipeline_stages.color }} />
                        <span className="text-slate-300">{d.crm_pipeline_stages.name}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-[#F47920] font-bold">{fmtValue(Number(d.deal_value))}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden xl:table-cell">
                    {d.expected_close ? new Date(d.expected_close).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
