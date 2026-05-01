'use client'
import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Loader2, Trash2, Save, CreditCard, X, Plus, Receipt,
  Download, Link2, Copy, Check, Eye, EyeOff,
} from 'lucide-react'
import clsx from 'clsx'
import Select from '@/components/ui/Select'

type LineItem = { description: string; qty: number; rate: number; total: number }
type Invoice = {
  id: string; invoice_number: string; status: string
  issue_date: string; due_date: string | null; paid_date: string | null
  items: LineItem[]; subtotal: number; tax_pct: number; total: number
  paid_amount: number; currency: string; notes: string
  account_id: string | null
  crm_accounts: { name: string } | null
  created_at: string
}

type Payment = {
  id: string; amount: number; currency: string
  payment_method: string; reference: string | null; paid_at: string
  notes: string | null; created_at: string
  crm_users: { full_name: string } | null
}

const STATUS_OPTIONS = ['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled', 'void']
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-500/15 text-slate-400',
  sent: 'bg-blue-500/15 text-blue-400',
  partially_paid: 'bg-yellow-500/15 text-yellow-400',
  paid: 'bg-emerald-500/15 text-emerald-400',
  overdue: 'bg-red-500/15 text-red-400',
  cancelled: 'bg-slate-500/15 text-slate-500',
  void: 'bg-slate-500/15 text-slate-500',
}

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'online', label: 'Online Gateway' },
  { value: 'other', label: 'Other' },
]

const fmt = (n: number, c = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n ?? 0)
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [form, setForm] = useState<Partial<Invoice>>({})
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [invRes, payRes] = await Promise.all([
        fetch(`/api/invoices/${id}`).then(r => r),
        fetch(`/api/invoices/${id}/payments`).then(r => r.json()),
      ])
      if (invRes.status === 404) { setNotFound(true); return }
      const data = await invRes.json()
      if (!invRes.ok) { toast.error(data.error ?? 'Failed to load invoice.'); return }
      setInvoice(data.data)
      setForm(data.data)
      setPayments(payRes.data ?? [])
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  function update<K extends keyof Invoice>(k: K, v: Invoice[K]) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    setSaving(true)
    try {
      const payload = { status: form.status, due_date: form.due_date, notes: form.notes }
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Save failed.'); return }
      toast.success('Invoice updated.')
      load()
    } finally { setSaving(false) }
  }

  async function remove() {
    if (!confirm('Delete this invoice? This cannot be undone.')) return
    const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Invoice deleted.'); router.push('/invoices') }
    else toast.error('Delete failed.')
  }

  async function reversePayment(paymentId: string) {
    if (!confirm('Reverse this payment? The invoice balance will be recalculated.')) return
    const res = await fetch(`/api/invoices/${id}/payments/${paymentId}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Failed to reverse payment.'); return }
    toast.success('Payment reversed.')
    load()
  }

  if (loading) {
    return <div className="p-6 max-w-5xl">
      <div className="h-8 w-48 bg-white/5 rounded animate-pulse mb-6" />
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 h-96 bg-white/5 rounded-xl animate-pulse" />
        <div className="h-96 bg-white/5 rounded-xl animate-pulse" />
      </div>
    </div>
  }

  if (notFound || !invoice) {
    return <div className="p-6 max-w-2xl">
      <div className="bg-[#0D1B2E] border border-red-500/20 rounded-xl p-8 text-center">
        <p className="text-white font-semibold mb-2">Invoice not found</p>
        <Link href="/invoices" className="text-[#F47920] text-sm font-semibold hover:underline">← Back to invoices</Link>
      </div>
    </div>
  }

  const total = Number(invoice.total ?? 0)
  const paid = Number(invoice.paid_amount ?? 0)
  const outstanding = Math.max(0, total - paid)
  const isLocked = ['cancelled', 'void'].includes(invoice.status)
  const isFullyPaid = outstanding < 0.01

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 focus:ring-1 focus:ring-[#F47920]/20 transition disabled:opacity-50'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <button onClick={() => router.push('/invoices')} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition shrink-0 mt-0.5">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-white font-bold text-xl">{invoice.invoice_number}</h1>
            <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', STATUS_COLORS[invoice.status])}>{invoice.status.replace('_', ' ')}</span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            {invoice.crm_accounts?.name ?? '—'} · Issued {fmtDate(invoice.issue_date)} · Due {fmtDate(invoice.due_date)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a href={`/api/invoices/${id}/pdf`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-medium px-3 py-2 rounded-lg text-sm transition border border-white/10"
            title="Download PDF">
            <Download className="w-4 h-4" /> PDF
          </a>
          <ShareButton invoiceId={id} />
          {!isLocked && (
            <button onClick={() => setShowPaymentModal(true)}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition">
              <CreditCard className="w-4 h-4" /> {isFullyPaid ? 'Add Payment' : 'Record Payment'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Line items */}
          <div className="bg-[#0D1B2E] border border-white/5 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-4 py-3 text-xs text-slate-400 font-semibold">Description</th>
                  <th className="text-right px-4 py-3 text-xs text-slate-400 font-semibold w-20">Qty</th>
                  <th className="text-right px-4 py-3 text-xs text-slate-400 font-semibold w-32">Rate</th>
                  <th className="text-right px-4 py-3 text-xs text-slate-400 font-semibold w-32">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {invoice.items.map((li, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 text-white">{li.description}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{li.qty}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{fmt(li.rate, invoice.currency)}</td>
                    <td className="px-4 py-3 text-right text-white font-medium">{fmt(li.total, invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-white/3 border-t border-white/5">
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right text-slate-400 text-xs">Subtotal</td>
                  <td className="px-4 py-2 text-right text-slate-300 tabular-nums">{fmt(invoice.subtotal, invoice.currency)}</td>
                </tr>
                {invoice.tax_pct > 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right text-slate-400 text-xs">Tax ({invoice.tax_pct}%)</td>
                    <td className="px-4 py-2 text-right text-slate-300 tabular-nums">{fmt(total - invoice.subtotal, invoice.currency)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right text-white font-bold">Total</td>
                  <td className="px-4 py-2 text-right text-white font-bold tabular-nums">{fmt(total, invoice.currency)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right text-emerald-400 text-xs">Paid</td>
                  <td className="px-4 py-2 text-right text-emerald-400 tabular-nums">{fmt(paid, invoice.currency)}</td>
                </tr>
                {outstanding > 0 && (
                  <tr className="border-t border-white/5">
                    <td colSpan={3} className="px-4 py-2 text-right text-[#F47920] font-bold">Outstanding</td>
                    <td className="px-4 py-2 text-right text-[#F47920] font-bold tabular-nums">{fmt(outstanding, invoice.currency)}</td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>

          {/* Payment history */}
          <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4" /> Payment History
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">{payments.length} payment{payments.length === 1 ? '' : 's'}</span>
                {!isLocked && (
                  <button onClick={() => setShowPaymentModal(true)}
                    className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-xs font-semibold transition">
                    <Plus className="w-3 h-3" /> Add Payment
                  </button>
                )}
              </div>
            </div>
            {payments.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-slate-500 text-sm mb-2">No payments recorded yet.</p>
                {paid > 0 && (
                  <p className="text-yellow-400 text-xs">
                    Note: {fmt(paid, invoice.currency)} is shown as paid but no ledger entries exist. Click "Add Payment" to backfill.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {payments.map(p => (
                  <div key={p.id} className="flex items-start gap-3 bg-white/3 border border-white/5 rounded-lg p-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-white text-sm font-semibold tabular-nums">{fmt(p.amount, p.currency)}</p>
                        <p className="text-slate-500 text-xs whitespace-nowrap">{fmtDate(p.paid_at)}</p>
                      </div>
                      <p className="text-slate-400 text-xs capitalize">
                        {p.payment_method.replace('_', ' ')}
                        {p.reference && <span className="text-slate-600"> · Ref: {p.reference}</span>}
                        {p.crm_users?.full_name && <span className="text-slate-600"> · by {p.crm_users.full_name}</span>}
                      </p>
                      {p.notes && <p className="text-slate-500 text-xs mt-1">{p.notes}</p>}
                    </div>
                    <button onClick={() => reversePayment(p.id)}
                      className="text-slate-500 hover:text-red-400 transition shrink-0" title="Reverse payment">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes & status edit */}
          <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6">
            <h2 className="text-white font-semibold text-sm mb-4">Invoice Settings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={labelCls}>Status</label>
                <Select value={form.status ?? ''} onValueChange={v => update('status', v)}
                  options={STATUS_OPTIONS.map(s => ({ value: s, label: s.replace('_', ' ') }))} />
              </div>
              <div><label className={labelCls}>Due Date</label>
                <input type="date" className={inputCls} value={form.due_date ?? ''}
                  onChange={e => update('due_date', (e.target.value || null) as Invoice['due_date'])} />
              </div>
              <div className="sm:col-span-2"><label className={labelCls}>Notes</label>
                <textarea className={clsx(inputCls, 'min-h-[80px] resize-y')} value={form.notes ?? ''} onChange={e => update('notes', e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 mt-5 pt-4 border-t border-white/5">
              <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm transition">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={remove} className="flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 font-medium px-5 py-2 rounded-lg text-sm transition">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-5">
            <p className="text-slate-400 text-xs uppercase tracking-wide font-semibold mb-3">Balance</p>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-slate-500 text-xs">Total invoiced</span><span className="text-white text-sm font-medium tabular-nums">{fmt(total, invoice.currency)}</span></div>
              <div className="flex justify-between"><span className="text-emerald-400 text-xs">Paid</span><span className="text-emerald-400 text-sm font-medium tabular-nums">{fmt(paid, invoice.currency)}</span></div>
              <div className="border-t border-white/5 pt-2 flex justify-between">
                <span className="text-[#F47920] text-xs font-bold uppercase">Outstanding</span>
                <span className={clsx('text-sm font-bold tabular-nums', outstanding === 0 ? 'text-emerald-400' : 'text-[#F47920]')}>{fmt(outstanding, invoice.currency)}</span>
              </div>
            </div>
            {isFullyPaid && (
              <div className="mt-3 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-xs text-center font-medium">
                Fully paid {invoice.paid_date && `on ${fmtDate(invoice.paid_date)}`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <RecordPaymentModal
          invoiceId={id}
          outstanding={outstanding}
          paidAmount={paid}
          total={total}
          currency={invoice.currency}
          onClose={() => setShowPaymentModal(false)}
          onRecorded={() => { setShowPaymentModal(false); load() }}
        />
      )}
    </div>
  )
}

/* ───────────── Share Public Link Button ───────────── */
function ShareButton({ invoiceId }: { invoiceId: string }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/share`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to share.'); return }
      setUrl(data.url)
      setOpen(true)
    } finally { setLoading(false) }
  }

  async function revoke() {
    if (!confirm('Revoke the public link? Anyone with the existing link will lose access.')) return
    const res = await fetch(`/api/invoices/${invoiceId}/share`, { method: 'DELETE' })
    if (res.ok) { toast.success('Public link revoked.'); setUrl(null); setOpen(false) }
    else toast.error('Failed to revoke.')
  }

  function copy() {
    if (!url) return
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Link copied to clipboard')
  }

  // Auto-load the existing token (if any) the first time the button is clicked
  async function toggle() {
    if (open) { setOpen(false); return }
    if (!url) await generate()
    else setOpen(true)
  }

  return (
    <div className="relative">
      <button onClick={toggle} disabled={loading}
        className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-medium px-3 py-2 rounded-lg text-sm transition border border-white/10"
        title="Share public link">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
        Share
      </button>
      {open && url && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-[#0D1B2E] border border-white/10 rounded-xl shadow-2xl p-4 z-40">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white text-sm font-semibold flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-emerald-400" /> Public link active
            </p>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-slate-400 text-xs mb-3 leading-relaxed">
            Anyone with this link can view the invoice (no login required) and download the PDF.
          </p>
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1.5 mb-3">
            <input readOnly value={url} className="flex-1 bg-transparent text-white text-xs outline-none px-2 truncate" onClick={e => e.currentTarget.select()} />
            <button onClick={copy} className="bg-[#F47920]/15 hover:bg-[#F47920]/25 text-[#F47920] px-3 py-1 rounded text-xs font-semibold transition flex items-center gap-1">
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <a href={url} target="_blank" rel="noreferrer" className="text-[#F47920] text-xs font-semibold hover:underline">Open in new tab →</a>
            <button onClick={revoke} className="text-red-400 hover:text-red-300 text-xs font-medium flex items-center gap-1">
              <EyeOff className="w-3 h-3" /> Revoke link
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────────── Record Payment Modal ───────────── */
function RecordPaymentModal({
  invoiceId, outstanding, paidAmount, total, currency, onClose, onRecorded,
}: {
  invoiceId: string; outstanding: number; paidAmount: number; total: number; currency: string
  onClose: () => void; onRecorded: () => void
}) {
  void paidAmount; void total
  const [form, setForm] = useState({
    amount: outstanding > 0 ? outstanding.toString() : '',
    payment_method: 'bank_transfer',
    reference: '',
    paid_at: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const upd = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const amt = Number(form.amount)
    if (!Number.isFinite(amt) || amt <= 0) { toast.error('Enter a valid amount.'); return }

    let allowOverpay = false
    if (amt > outstanding + 0.01) {
      const excess = (amt - outstanding).toFixed(2)
      const confirmMsg = outstanding < 0.01
        ? `This invoice is already fully paid. Recording another ${currency} ${amt} payment will be treated as an over-payment / credit on file.\n\nProceed?`
        : `This payment of ${currency} ${amt} exceeds the outstanding balance (${currency} ${outstanding}) by ${currency} ${excess}.\n\nProceed anyway? The extra amount will be recorded as an over-payment.`
      if (!confirm(confirmMsg)) return
      allowOverpay = true
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          payment_method: form.payment_method,
          reference: form.reference || null,
          paid_at: form.paid_at ? new Date(form.paid_at).toISOString() : new Date().toISOString(),
          notes: form.notes || null,
          allow_overpay: allowOverpay,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to record payment.'); return }
      const newStatus = data.invoice?.status as string | undefined
      toast.success(
        newStatus === 'paid' ? 'Invoice fully paid!' :
        newStatus === 'partially_paid' ? `Partially paid · ${currency} ${data.invoice.outstanding} outstanding` :
        'Payment recorded.'
      )
      onRecorded()
    } finally { setSubmitting(false) }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 focus:ring-1 focus:ring-[#F47920]/20 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit}
        className="bg-[#0D1B2E] border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-400" /> Record Payment
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">
              Outstanding: <span className={clsx('font-semibold', outstanding > 0 ? 'text-[#F47920]' : 'text-emerald-400')}>
                {new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(outstanding)}
              </span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelCls}>Amount * ({currency})</label>
            <input type="number" min="0.01" step="0.01" required className={inputCls}
              value={form.amount} onChange={e => upd('amount', e.target.value)} autoFocus />
            {outstanding > 0 && (
              <button type="button" onClick={() => upd('amount', outstanding.toString())}
                className="text-[10px] text-[#F47920] hover:underline mt-1">Pay full outstanding</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Payment Method *</label>
              <Select value={form.payment_method} onValueChange={v => upd('payment_method', v)} options={PAYMENT_METHODS} />
            </div>
            <div>
              <label className={labelCls}>Date *</label>
              <input type="date" required className={inputCls} value={form.paid_at} onChange={e => upd('paid_at', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Reference / Transaction ID</label>
            <input className={inputCls} placeholder="UTR / cheque number / txn ID" value={form.reference} onChange={e => upd('reference', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Notes (optional)</label>
            <textarea className={clsx(inputCls, 'min-h-[60px] resize-y')} value={form.notes} onChange={e => upd('notes', e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-white/5">
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white px-4 py-2 text-sm font-medium">Cancel</button>
          <button type="submit" disabled={submitting}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm transition">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {submitting ? 'Recording…' : 'Record Payment'}
          </button>
        </div>
      </form>
    </div>
  )
}
