'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import Select from '@/components/ui/Select'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

type User = { id: string; full_name: string }

export default function NewTerritoryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [form, setForm] = useState({
    name: '', description: '', regions: '',
    manager_id: '',
  })
  const [memberIds, setMemberIds] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/team').then(r => r.json()).then(d => setUsers(d.data ?? []))
  }, [])

  function update(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  function toggleMember(id: string) {
    setMemberIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name is required.'); return }
    setLoading(true)
    try {
      const regions = form.regions.split(',').map(r => r.trim()).filter(Boolean)
      const res = await fetch('/api/territories', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          regions,
          manager_id: form.manager_id || null,
          member_ids: memberIds,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Territory created.')
      router.push(`/territories/${data.data.id}`)
    } finally { setLoading(false) }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader title="New Territory" backHref="/territories" />
      <form onSubmit={submit} className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className={labelCls}>Name *</label>
            <input required className={inputCls} placeholder="North India" value={form.name} onChange={e => update('name', e.target.value)} /></div>
          <div className="col-span-2"><label className={labelCls}>Description</label>
            <textarea className={inputCls + ' min-h-[60px] resize-y'} value={form.description} onChange={e => update('description', e.target.value)} /></div>
          <div className="col-span-2"><label className={labelCls}>Regions (comma-separated)</label>
            <input className={inputCls} placeholder="Delhi, UP, Punjab, Haryana" value={form.regions} onChange={e => update('regions', e.target.value)} /></div>
          <div className="col-span-2"><label className={labelCls}>Manager</label>
            <Select value={form.manager_id} onValueChange={v => update('manager_id', v)}
              options={[{ value: '', label: '— none —' }, ...users.map(u => ({ value: u.id, label: u.full_name }))]} /></div>
          <div className="col-span-2">
            <label className={labelCls}>Members</label>
            <div className="bg-white/5 border border-white/10 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
              {users.length === 0 ? <p className="text-slate-500 text-xs">No users available.</p> :
                users.map(u => (
                  <label key={u.id} className="flex items-center gap-2 cursor-pointer text-sm text-slate-300 hover:text-white py-1">
                    <input type="checkbox" checked={memberIds.includes(u.id)} onChange={() => toggleMember(u.id)}
                      className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#F47920]" />
                    {u.full_name}
                  </label>
                ))
              }
            </div>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Saving…' : 'Create Territory'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition">Cancel</button>
        </div>
      </form>
    </div>
  )
}
