'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import Select from '@/components/ui/Select'
import toast from 'react-hot-toast'
import { Loader2, Send, Save } from 'lucide-react'

const CATEGORIES = ['travel', 'meals', 'accommodation', 'supplies', 'software', 'marketing', 'training', 'client_entertainment', 'general', 'other']

export default function NewExpensePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState({
    category: 'general', amount: '', currency: 'INR',
    expense_date: new Date().toISOString().split('T')[0],
    description: '', receipt_url: '', project_id: '',
    is_billable: false, reimbursable: true, notes: '',
  })

  useEffect(() => {
    fetch('/api/projects?pageSize=200').then(r => r.json()).then(d => setProjects(d.data ?? []))
  }, [])

  function update(field: string, value: string | boolean) { setForm(f => ({ ...f, [field]: value })) }

  async function submit(e: React.FormEvent, asSubmitted = false) {
    e.preventDefault()
    if (!form.description.trim()) { toast.error('Description required.'); return }
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Amount must be positive.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          project_id: form.project_id || null,
          submit: asSubmitted,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success(asSubmitted ? 'Expense submitted for approval.' : 'Expense saved as draft.')
      router.push(`/expenses/${data.data.id}`)
    } finally { setLoading(false) }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader title="New Expense" backHref="/expenses" />
      <form onSubmit={e => submit(e, false)} className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className={labelCls}>Description *</label>
            <input required className={inputCls} placeholder="Client lunch · Mumbai trip" value={form.description} onChange={e => update('description', e.target.value)} /></div>
          <div><label className={labelCls}>Date *</label>
            <input required type="date" className={inputCls} value={form.expense_date} onChange={e => update('expense_date', e.target.value)} /></div>
          <div><label className={labelCls}>Category</label>
            <Select value={form.category} onValueChange={v => update('category', v)}
              options={CATEGORIES.map(c => ({ value: c, label: c.replace('_', ' ') }))} /></div>
          <div><label className={labelCls}>Amount *</label>
            <input required type="number" min="0.01" step="0.01" className={inputCls} placeholder="2500" value={form.amount} onChange={e => update('amount', e.target.value)} /></div>
          <div><label className={labelCls}>Currency</label>
            <Select value={form.currency} onValueChange={v => update('currency', v)}
              options={['INR', 'USD', 'EUR', 'GBP', 'AED'].map(c => ({ value: c, label: c }))} /></div>
          <div className="col-span-2"><label className={labelCls}>Project (optional)</label>
            <Select value={form.project_id} onValueChange={v => update('project_id', v)}
              placeholder="No project" allowClear clearLabel="No project"
              options={projects.map(p => ({ value: p.id, label: p.name }))} /></div>
          <div className="col-span-2"><label className={labelCls}>Receipt URL</label>
            <input className={inputCls} placeholder="https://… (link to receipt scan)" value={form.receipt_url} onChange={e => update('receipt_url', e.target.value)} /></div>
          <div className="col-span-2 flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_billable} onChange={e => update('is_billable', e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#F47920]" />
              <span className="text-white text-sm">Billable to client</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.reimbursable} onChange={e => update('reimbursable', e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#F47920]" />
              <span className="text-white text-sm">Reimbursable to me</span>
            </label>
          </div>
          <div className="col-span-2"><label className={labelCls}>Notes</label>
            <textarea className={inputCls + ' min-h-[60px] resize-y'} value={form.notes} onChange={e => update('notes', e.target.value)} /></div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 disabled:opacity-60 text-slate-300 font-semibold px-5 py-2.5 rounded-lg text-sm transition border border-white/10">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Draft
          </button>
          <button type="button" disabled={loading} onClick={e => submit(e as unknown as React.FormEvent, true)}
            className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit for Approval
          </button>
        </div>
      </form>
    </div>
  )
}
