'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

type Account = { id: string; name: string }
type Contact = { id: string; first_name: string; last_name: string }
type User    = { id: string; full_name: string }

export default function NewTicketPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium', type: 'general',
    account_id: '', contact_id: '', assigned_to: '', sla_due_at: '',
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
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          account_id: form.account_id || null,
          contact_id: form.contact_id || null,
          assigned_to: form.assigned_to || null,
          sla_due_at: form.sla_due_at || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success(`Ticket ${data.data.ticket_number} created!`)
      router.push('/support')
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
      <PageHeader title="New Support Ticket" backHref="/support" />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6">
          <h3 className="text-slate-300 text-sm font-semibold mb-4">Ticket Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Title *</label>
              <input className={inputCls} placeholder="Describe the issue briefly" value={form.title} onChange={e => update('title', e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select className={inputCls} value={form.priority} onChange={e => update('priority', e.target.value)}>
                {['low','medium','high','critical'].map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select className={inputCls} value={form.type} onChange={e => update('type', e.target.value)}>
                {['general','billing','technical','feature_request','complaint','other'].map(t => (
                  <option key={t} value={t} className="capitalize">{t.replace('_', ' ')}</option>
                ))}
              </select>
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
              <label className={labelCls}>SLA Due Date</label>
              <input type="datetime-local" className={inputCls} value={form.sla_due_at} onChange={e => update('sla_due_at', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Description</label>
              <textarea rows={4} className={inputCls} placeholder="Detailed description of the issue…" value={form.description} onChange={e => update('description', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Saving…' : 'Create Ticket'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition">Cancel</button>
        </div>
      </form>
    </div>
  )
}
