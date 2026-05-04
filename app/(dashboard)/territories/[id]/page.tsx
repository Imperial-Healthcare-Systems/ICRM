'use client'

import { use, useEffect, useState } from 'react'
import DetailShell, { inputCls, labelCls } from '@/components/DetailShell'
import Select from '@/components/ui/Select'

type Territory = {
  id: string; name: string; description: string | null
  regions: string[]; member_ids: string[]
  manager_id: string | null; is_active: boolean
}

type User = { id: string; full_name: string }

export default function TerritoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    fetch('/api/team').then(r => r.json()).then(d => setUsers(d.data ?? []))
  }, [])

  return (
    <DetailShell<Territory>
      id={id}
      apiPath="/api/territories"
      backHref="/territories"
      entityLabel="territory"
      title={(t) => t.name}
      subtitle={(t) => t.description ?? '—'}
      badges={(t) => !t.is_active ? <span className="text-[10px] text-slate-500 italic">Inactive</span> : null}
      validate={(f) => !f.name?.trim() ? 'Name is required.' : null}
      buildPayload={(f) => ({
        name: f.name,
        description: f.description ?? null,
        regions: f.regions ?? [],
        manager_id: f.manager_id || null,
        member_ids: f.member_ids ?? [],
        is_active: f.is_active ?? true,
      })}
    >
      {(_record, form, update) => {
        const memberIds = (form.member_ids ?? []) as string[]
        const regionsStr = (form.regions ?? []).join(', ')
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className={labelCls}>Name *</label>
              <input className={inputCls} value={form.name ?? ''} onChange={e => update('name', e.target.value)} /></div>
            <div className="col-span-2"><label className={labelCls}>Description</label>
              <textarea className={inputCls + ' min-h-[60px] resize-y'} value={form.description ?? ''}
                onChange={e => update('description', e.target.value)} /></div>
            <div className="col-span-2"><label className={labelCls}>Regions (comma-separated)</label>
              <input className={inputCls} value={regionsStr}
                onChange={e => update('regions', e.target.value.split(',').map(r => r.trim()).filter(Boolean) as never)} /></div>
            <div className="col-span-2"><label className={labelCls}>Manager</label>
              <Select value={form.manager_id ?? ''} onValueChange={v => update('manager_id', (v || null) as never)}
                options={[{ value: '', label: '— none —' }, ...users.map(u => ({ value: u.id, label: u.full_name }))]} /></div>
            <div className="col-span-2">
              <label className={labelCls}>Members ({memberIds.length})</label>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
                {users.map(u => (
                  <label key={u.id} className="flex items-center gap-2 cursor-pointer text-sm text-slate-300 hover:text-white py-1">
                    <input type="checkbox" checked={memberIds.includes(u.id)}
                      onChange={() => {
                        const next = memberIds.includes(u.id)
                          ? memberIds.filter(x => x !== u.id)
                          : [...memberIds, u.id]
                        update('member_ids', next as never)
                      }}
                      className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#F47920]" />
                    {u.full_name}
                  </label>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 text-sm">
                <input type="checkbox" checked={form.is_active ?? true}
                  onChange={e => update('is_active', e.target.checked as never)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#F47920]" />
                Active
              </label>
            </div>
          </div>
        )
      }}
    </DetailShell>
  )
}
