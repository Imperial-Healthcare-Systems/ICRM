'use client'

import { useEffect, useState, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ArrowLeft, Pause, Play, X, FileText, Trash2, Loader2, RefreshCw } from 'lucide-react'
import clsx from 'clsx'

type Sub = {
  id: string; subscription_number: string; name: string; description: string
  amount: number; currency: string; tax_pct: number
  billing_cycle: string; cycle_days: number | null
  status: string; start_date: string; end_date: string | null; next_billing_date: string
  last_billed_at: string | null; invoices_generated: number; auto_renew: boolean
  payment_terms_days: number; notes: string
  cancellation_reason: string | null; cancelled_at: string | null
  crm_accounts: { id: string; name: string } | null
  crm_contacts: { id: string; first_name: string; last_name: string } | null
  crm_products: { id: string; name: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-emerald-500/15 text-emerald-400',
  paused:    'bg-yellow-500/15 text-yellow-400',
  cancelled: 'bg-red-500/15 text-red-400',
  expired:   'bg-slate-500/15 text-slate-400',
}

const fmt = (n: number, c = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n ?? 0)
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export default function SubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [sub, setSub] = useState<Sub | null>(null)
  const [form, setForm] = useState<Partial<Sub>>({})
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/subscriptions/${id}`)
      if (res.status === 404) { setNotFound(true); return }
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setSub(data.data); setForm(data.data)
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  function update<K extends keyof Sub>(k: K, v: Sub[K]) { setForm(f => ({ ...f, [k]: v })) }

  async function action(verb: 'pause' | 'resume' | 'cancel' | 'generate_invoice', extra?: Record<string, unknown>) {
    setActing(true)
    try {
      const res = await fetch(`/api/subscriptions/${id}/action`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: verb, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      if (verb === 'generate_invoice') toast.success(`Invoice ${data.data?.invoice_number ?? ''} created.`)
      else toast.success(`Subscription ${verb}d.`)
      load()
    } finally { setActing(false) }
  }

  async function cancel() {
    const reason = prompt('Reason for cancellation? (optional)')
    if (reason === null) return
    await action('cancel', { reason })
  }

  async function save() {
    setSaving(true)
    try {
      const payload = {
        name: form.name, description: form.description,
        amount: form.amount, tax_pct: form.tax_pct,
        next_billing_date: form.next_billing_date, end_date: form.end_date,
        payment_terms_days: form.payment_terms_days, auto_renew: form.auto_renew,
        notes: form.notes,
      }
      const res = await fetch(`/api/subscriptions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Subscription updated.'); load()
    } finally { setSaving(false) }
  }

  async function remove() {
    if (!confirm('Delete this subscription? Invoices already generated will remain.')) return
    const res = await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Deleted.'); router.push('/subscriptions') }
    else toast.error('Delete failed.')
  }

  if (loading) return <div className="p-6 max-w-5xl"><div className="h-8 w-64 bg-white/5 rounded animate-pulse" /></div>
  if (notFound || !sub) return <div className="p-6"><Link href="/subscriptions" className="text-[#F47920]">← Back</Link></div>

  const isActive = sub.status === 'active'
  const isPaused = sub.status === 'paused'
  const isTerminal = ['cancelled', 'expired'].includes(sub.status)
  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-start gap-3 mb-6">
        <button onClick={() => router.push('/subscriptions')} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white shrink-0"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-white font-bold text-xl font-mono">{sub.subscription_number}</h1>
            <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', STATUS_COLORS[sub.status])}>{sub.status}</span>
            <span className="text-slate-300 font-semibold">{sub.name}</span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            {sub.crm_accounts?.name} · {fmt(sub.amount, sub.currency)} per {sub.billing_cycle.replace('_', ' ')}
            {sub.crm_contacts && ` · Contact: ${sub.crm_contacts.first_name} ${sub.crm_contacts.last_name ?? ''}`}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {isActive && (
            <button onClick={() => action('generate_invoice')} disabled={acting}
              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition">
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Bill Now
            </button>
          )}
          {isActive && <button onClick={() => action('pause')} disabled={acting} className="flex items-center gap-1.5 bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25 font-semibold px-4 py-2 rounded-lg text-sm transition"><Pause className="w-4 h-4" /> Pause</button>}
          {isPaused && <button onClick={() => action('resume')} disabled={acting} className="flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 font-semibold px-4 py-2 rounded-lg text-sm transition"><Play className="w-4 h-4" /> Resume</button>}
          {!isTerminal && <button onClick={cancel} disabled={acting} className="flex items-center gap-1.5 bg-red-500/15 text-red-400 hover:bg-red-500/25 font-semibold px-4 py-2 rounded-lg text-sm transition"><X className="w-4 h-4" /> Cancel</button>}
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Per cycle" value={fmt(sub.amount, sub.currency)} />
        <Stat label="Next billing" value={fmtDate(sub.next_billing_date)} highlight={isActive && sub.next_billing_date <= new Date().toISOString().split('T')[0]} />
        <Stat label="Last billed" value={fmtDate(sub.last_billed_at?.split('T')[0] ?? null)} />
        <Stat label="Invoices" value={String(sub.invoices_generated)} />
      </div>

      {/* Cancellation banner */}
      {sub.status === 'cancelled' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
          <p className="text-red-300 text-xs uppercase tracking-wider font-bold">Cancelled on {fmtDate(sub.cancelled_at?.split('T')[0] ?? null)}</p>
          {sub.cancellation_reason && <p className="text-red-200 text-sm mt-1">{sub.cancellation_reason}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings */}
        <div className="lg:col-span-2 bg-[#0D1B2E] border border-white/5 rounded-xl p-6">
          <h2 className="text-white font-semibold text-sm mb-4 flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Settings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className={labelCls}>Name</label>
              <input className={inputCls} value={form.name ?? ''} onChange={e => update('name', e.target.value)} disabled={isTerminal} /></div>
            <div><label className={labelCls}>Amount (₹)</label>
              <input type="number" className={inputCls} value={form.amount ?? 0} onChange={e => update('amount', Number(e.target.value))} disabled={isTerminal} /></div>
            <div><label className={labelCls}>Tax %</label>
              <input type="number" className={inputCls} value={form.tax_pct ?? 0} onChange={e => update('tax_pct', Number(e.target.value))} disabled={isTerminal} /></div>
            <div><label className={labelCls}>Next Billing Date</label>
              <input type="date" className={inputCls} value={form.next_billing_date ?? ''} onChange={e => update('next_billing_date', e.target.value)} disabled={isTerminal} /></div>
            <div><label className={labelCls}>End Date</label>
              <input type="date" className={inputCls} value={form.end_date ?? ''} onChange={e => update('end_date', e.target.value || null as unknown as string)} disabled={isTerminal} /></div>
            <div><label className={labelCls}>Payment Terms (days)</label>
              <input type="number" className={inputCls} value={form.payment_terms_days ?? 7} onChange={e => update('payment_terms_days', Number(e.target.value))} disabled={isTerminal} /></div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.auto_renew ?? false} onChange={e => update('auto_renew', e.target.checked)} disabled={isTerminal}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#F47920]" />
                <span className="text-white text-xs">Auto-renew</span>
              </label>
            </div>
            <div className="sm:col-span-2"><label className={labelCls}>Notes</label>
              <textarea className={inputCls + ' min-h-[80px] resize-y'} value={form.notes ?? ''} onChange={e => update('notes', e.target.value)} disabled={isTerminal} /></div>
          </div>
          {!isTerminal && (
            <div className="flex gap-2 mt-5 pt-4 border-t border-white/5">
              <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={remove} className="flex items-center gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 px-4 py-2 rounded-lg text-sm">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-5">
            <h3 className="text-slate-300 text-xs font-semibold uppercase tracking-wide mb-3">Cycle</h3>
            <p className="text-white text-sm font-semibold capitalize">{sub.billing_cycle.replace('_', ' ')}</p>
            {sub.cycle_days && <p className="text-slate-500 text-xs mt-1">{sub.cycle_days} days</p>}
            <p className="text-slate-500 text-xs mt-3">Started {fmtDate(sub.start_date)}</p>
            {sub.end_date && <p className="text-slate-500 text-xs">Ends {fmtDate(sub.end_date)}</p>}
          </div>
          {sub.crm_accounts && (
            <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-5">
              <h3 className="text-slate-300 text-xs font-semibold uppercase tracking-wide mb-2">Customer</h3>
              <p className="text-white text-sm font-semibold">{sub.crm_accounts.name}</p>
              {sub.crm_contacts && <p className="text-slate-500 text-xs mt-1">{sub.crm_contacts.first_name} {sub.crm_contacts.last_name}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={clsx('bg-[#0D1B2E] border rounded-xl p-4', highlight ? 'border-orange-500/40' : 'border-white/5')}>
      <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className={clsx('font-bold', highlight ? 'text-orange-400' : 'text-white')}>{value}</p>
    </div>
  )
}
