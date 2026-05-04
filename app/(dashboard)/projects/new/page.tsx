'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import Select from '@/components/ui/Select'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

type Account = { id: string; name: string }
type User = { id: string; full_name: string }

export default function NewProjectPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [form, setForm] = useState({
    name: '', description: '', account_id: '', owner_id: '',
    status: 'planning', priority: 'medium',
    start_date: '', end_date: '',
    budget: '', currency: 'INR', hourly_rate: '',
    is_billable: true,
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/accounts?pageSize=200').then(r => r.json()),
      fetch('/api/team').then(r => r.json()),
    ]).then(([a, u]) => {
      setAccounts(a.data ?? [])
      setUsers(u.data ?? [])
    })
  }, [])

  function update(field: string, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          account_id: form.account_id || null,
          owner_id: form.owner_id || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          budget: form.budget ? Number(form.budget) : null,
          hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Project created!')
      router.push(`/projects/${data.data.id}`)
    } finally { setLoading(false) }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader title="New Project" backHref="/projects" />
      <form onSubmit={submit} className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>Project Name *</label>
            <input required className={inputCls} placeholder="Website redesign for Acme Corp" value={form.name} onChange={e => update('name', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Description</label>
            <textarea className={inputCls + ' min-h-[80px] resize-y'} placeholder="Project goals, deliverables, scope…" value={form.description} onChange={e => update('description', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Account</label>
            <Select value={form.account_id} onValueChange={v => update('account_id', v)}
              placeholder="No account" allowClear clearLabel="No account"
              options={accounts.map(a => ({ value: a.id, label: a.name }))} />
          </div>
          <div>
            <label className={labelCls}>Owner</label>
            <Select value={form.owner_id} onValueChange={v => update('owner_id', v)}
              placeholder="Assign owner" allowClear clearLabel="Me"
              options={users.map(u => ({ value: u.id, label: u.full_name }))} />
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <Select value={form.status} onValueChange={v => update('status', v)}
              options={['planning','active','on_hold','completed','cancelled'].map(s => ({ value: s, label: s.replace('_', ' ') }))} />
          </div>
          <div>
            <label className={labelCls}>Priority</label>
            <Select value={form.priority} onValueChange={v => update('priority', v)}
              options={['low','medium','high','critical'].map(s => ({ value: s, label: s }))} />
          </div>
          <div>
            <label className={labelCls}>Start Date</label>
            <input type="date" className={inputCls} value={form.start_date} onChange={e => update('start_date', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>End Date</label>
            <input type="date" className={inputCls} value={form.end_date} onChange={e => update('end_date', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Budget (₹)</label>
            <input type="number" min="0" className={inputCls} placeholder="500000" value={form.budget} onChange={e => update('budget', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Hourly Rate (₹)</label>
            <input type="number" min="0" className={inputCls} placeholder="2500" value={form.hourly_rate} onChange={e => update('hourly_rate', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_billable} onChange={e => update('is_billable', e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#F47920] focus:ring-[#F47920]/40" />
              <span className="text-white text-sm">Billable to client</span>
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Saving…' : 'Create Project'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition">Cancel</button>
        </div>
      </form>
    </div>
  )
}
