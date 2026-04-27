'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

type Account = { id: string; name: string }
type Contact = { id: string; first_name: string; last_name: string }
type User    = { id: string; full_name: string }

export default function NewFieldVisitPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [form, setForm] = useState({
    title: '', account_id: '', contact_id: '', assigned_to: '',
    status: 'scheduled', scheduled_at: '', location: '', notes: '',
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/accounts?pageSize=100').then(r => r.json()),
      fetch('/api/contacts?pageSize=100').then(r => r.json()),
      fetch('/api/team?pageSize=100').then(r => r.json()),
    ]).then(([a, c, u]) => {
      setAccounts(a.data ?? [])
      setContacts(c.data ?? [])
      setUsers(u.data ?? [])
    })
  }, [])

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Title is required.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/field-visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          account_id: form.account_id || null,
          contact_id: form.contact_id || null,
          assigned_to: form.assigned_to || null,
          scheduled_at: form.scheduled_at || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success(`Visit ${data.data.visit_number} scheduled!`)
      router.push('/field-visits')
    } catch {
      toast.error('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 focus:ring-1 focus:ring-[#F47920]/20 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader title="Schedule Field Visit" backHref="/field-visits" />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6">
          <h3 className="text-slate-300 text-sm font-semibold mb-4">Visit Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Title *</label>
              <input className={inputCls} placeholder="Q2 Client Review Visit" value={form.title} onChange={e => update('title', e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Account</label>
              <select className={inputCls} value={form.account_id} onChange={e => update('account_id', e.target.value)}>
                <option value="">Select account</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Contact</label>
              <select className={inputCls} value={form.contact_id} onChange={e => update('contact_id', e.target.value)}>
                <option value="">Select contact</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name ?? ''}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Assign To</label>
              <select className={inputCls} value={form.assigned_to} onChange={e => update('assigned_to', e.target.value)}>
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={form.status} onChange={e => update('status', e.target.value)}>
                {['scheduled','in_progress','completed','cancelled'].map(s => (
                  <option key={s} value={s} className="capitalize">{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Scheduled Date & Time</label>
              <input type="datetime-local" className={inputCls} value={form.scheduled_at} onChange={e => update('scheduled_at', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Location</label>
              <input className={inputCls} placeholder="Address or landmark" value={form.location} onChange={e => update('location', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea rows={3} className={inputCls} placeholder="Purpose of visit, preparation notes…" value={form.notes} onChange={e => update('notes', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Saving…' : 'Schedule Visit'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition">Cancel</button>
        </div>
      </form>
    </div>
  )
}
