'use client'

import { useEffect, useState } from 'react'
import { GitBranch, Plus, Trash2, Save, Loader2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type Stage = {
  id: string; name: string; color: string
  position: number; probability: number; is_won: boolean; is_lost: boolean
}

const PRESET_COLORS = [
  '#6B7280','#3B82F6','#8B5CF6','#F59E0B',
  '#10B981','#F47920','#EC4899','#EF4444','#06B6D4',
]

export default function PipelineSettings() {
  const [stages, setStages] = useState<Stage[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newStage, setNewStage] = useState({ name: '', color: '#6B7280', probability: 0, is_won: false, is_lost: false })

  useEffect(() => {
    fetch('/api/pipeline-stages').then(r => r.json()).then(d => {
      setStages(d.data ?? [])
      setLoading(false)
    })
  }, [])

  async function updateStage(id: string, updates: Partial<Stage>) {
    setSaving(id)
    const res = await fetch(`/api/pipeline-stages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error); setSaving(null); return }
    setStages(prev => prev.map(s => s.id === id ? { ...s, ...data.data } : s))
    setSaving(null)
  }

  async function deleteStage(id: string) {
    setDeleting(id)
    const res = await fetch(`/api/pipeline-stages/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error); setDeleting(null); return }
    setStages(prev => prev.filter(s => s.id !== id))
    toast.success('Stage deleted.')
    setDeleting(null)
  }

  async function addStage() {
    if (!newStage.name.trim()) { toast.error('Stage name is required.'); return }
    setSaving('new')
    const res = await fetch('/api/pipeline-stages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newStage),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error); setSaving(null); return }
    setStages(prev => [...prev, data.data])
    setNewStage({ name: '', color: '#6B7280', probability: 0, is_won: false, is_lost: false })
    setAdding(false)
    toast.success('Stage added.')
    setSaving(null)
  }

  async function moveStage(id: string, dir: 'up' | 'down') {
    const idx = stages.findIndex(s => s.id === id)
    if (dir === 'up' && idx === 0) return
    if (dir === 'down' && idx === stages.length - 1) return

    const other = stages[dir === 'up' ? idx - 1 : idx + 1]
    const newPos = other.position
    const oldPos = stages[idx].position

    // Optimistic update
    setStages(prev => prev.map(s => {
      if (s.id === id) return { ...s, position: newPos }
      if (s.id === other.id) return { ...s, position: oldPos }
      return s
    }).sort((a, b) => a.position - b.position))

    await Promise.all([
      fetch(`/api/pipeline-stages/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ position: newPos }) }),
      fetch(`/api/pipeline-stages/${other.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ position: oldPos }) }),
    ])
  }

  const inputCls = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#F47920]/60 transition'

  if (loading) return <div className="p-8"><div className="h-64 bg-white/3 rounded-xl animate-pulse" /></div>

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitBranch className="w-5 h-5 text-[#F47920]" />
          <div>
            <h1 className="text-white font-bold text-xl">Pipeline Stages</h1>
            <p className="text-slate-500 text-sm">Customize your deal pipeline stages.</p>
          </div>
        </div>
        <button
          onClick={() => setAdding(v => !v)}
          className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] text-white font-semibold px-4 py-2 rounded-lg text-sm transition"
        >
          <Plus className="w-4 h-4" />
          Add Stage
        </button>
      </div>

      {/* Add stage form */}
      {adding && (
        <div className="bg-[#0D1B2E] border border-[#F47920]/20 rounded-xl p-5 space-y-3">
          <p className="text-white font-semibold text-sm">New Stage</p>
          <div className="flex flex-wrap items-center gap-3">
            <input className={clsx(inputCls, 'flex-1 min-w-40')} placeholder="Stage name" value={newStage.name} onChange={e => setNewStage(s => ({ ...s, name: e.target.value }))} />
            <input type="number" min={0} max={100} className={clsx(inputCls, 'w-28')} placeholder="Win %" value={newStage.probability} onChange={e => setNewStage(s => ({ ...s, probability: Number(e.target.value) }))} />
            <label className="flex items-center gap-1.5 text-slate-400 text-xs cursor-pointer">
              <input type="checkbox" checked={newStage.is_won} onChange={e => setNewStage(s => ({ ...s, is_won: e.target.checked, is_lost: false }))} className="accent-emerald-400" />
              Won stage
            </label>
            <label className="flex items-center gap-1.5 text-slate-400 text-xs cursor-pointer">
              <input type="checkbox" checked={newStage.is_lost} onChange={e => setNewStage(s => ({ ...s, is_lost: e.target.checked, is_won: false }))} className="accent-red-400" />
              Lost stage
            </label>
          </div>
          {/* Color picker */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs">Color:</span>
            {PRESET_COLORS.map(c => (
              <button key={c} onClick={() => setNewStage(s => ({ ...s, color: c }))}
                className={clsx('w-5 h-5 rounded-full transition', newStage.color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-[#0D1B2E]' : '')}
                style={{ background: c }} />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={addStage} disabled={saving === 'new'}
              className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg text-sm transition">
              {saving === 'new' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {saving === 'new' ? 'Adding…' : 'Add'}
            </button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm transition">Cancel</button>
          </div>
        </div>
      )}

      {/* Stages list */}
      <div className="space-y-2">
        {stages.length === 0 && (
          <p className="text-slate-600 text-sm text-center py-8">No pipeline stages yet. Add your first stage above.</p>
        )}
        {stages.map((stage, idx) => (
          <div key={stage.id} className="bg-[#0D1B2E] border border-white/5 rounded-xl p-4 flex items-center gap-3">
            {/* Reorder */}
            <div className="flex flex-col gap-0.5">
              <button onClick={() => moveStage(stage.id, 'up')} disabled={idx === 0} className="text-slate-600 hover:text-slate-300 disabled:opacity-20 transition">
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => moveStage(stage.id, 'down')} disabled={idx === stages.length - 1} className="text-slate-600 hover:text-slate-300 disabled:opacity-20 transition">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Color dot */}
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: stage.color }} />

            {/* Name */}
            <input
              className="flex-1 bg-transparent text-white text-sm font-medium focus:outline-none border-b border-transparent focus:border-[#F47920]/40 pb-0.5"
              value={stage.name}
              onChange={e => setStages(prev => prev.map(s => s.id === stage.id ? { ...s, name: e.target.value } : s))}
              onBlur={() => updateStage(stage.id, { name: stage.name })}
            />

            {/* Probability */}
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="number" min={0} max={100}
                className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs text-center focus:outline-none"
                value={stage.probability}
                onChange={e => setStages(prev => prev.map(s => s.id === stage.id ? { ...s, probability: Number(e.target.value) } : s))}
                onBlur={() => updateStage(stage.id, { probability: stage.probability })}
              />
              <span className="text-slate-500 text-xs">%</span>
            </div>

            {/* Badges */}
            {stage.is_won && <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">WON</span>}
            {stage.is_lost && <span className="text-[10px] font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">LOST</span>}

            {/* Save indicator */}
            {saving === stage.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 shrink-0" />}

            {/* Delete */}
            <button
              onClick={() => { if (confirm(`Delete "${stage.name}"? This cannot be undone.`)) deleteStage(stage.id) }}
              disabled={deleting === stage.id}
              className="text-slate-600 hover:text-red-400 transition shrink-0"
            >
              {deleting === stage.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
