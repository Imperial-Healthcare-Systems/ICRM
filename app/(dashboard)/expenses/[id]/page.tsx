'use client'

import { useEffect, useState, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ArrowLeft, Send, CheckCircle2, XCircle, Wallet, ExternalLink, Trash2, Loader2 } from 'lucide-react'
import clsx from 'clsx'

type Expense = {
  id: string; expense_number: string; amount: number; currency: string
  expense_date: string; category: string; description: string; status: string
  is_billable: boolean; reimbursable: boolean
  receipt_url: string | null; notes: string | null
  rejection_reason: string | null
  submitted_at: string | null; approved_at: string | null; reimbursed_at: string | null
  user_id: string
  crm_users: { id: string; full_name: string; email: string } | null
  crm_projects: { id: string; name: string } | null
  crm_accounts: { id: string; name: string } | null
  approver: { full_name: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  draft:      'bg-slate-500/15 text-slate-400',
  submitted:  'bg-blue-500/15 text-blue-400',
  approved:   'bg-emerald-500/15 text-emerald-400',
  rejected:   'bg-red-500/15 text-red-400',
  reimbursed: 'bg-purple-500/15 text-purple-400',
}

const fmt = (n: number, c = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n)
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const fmtDateTime = (s: string | null) => s ? new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

export default function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [expense, setExpense] = useState<Expense | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/expenses/${id}`)
      if (res.status === 404) { setNotFound(true); return }
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setExpense(data.data)
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  async function action(action: 'submit' | 'approve' | 'reject' | 'reimburse', extra?: Record<string, unknown>) {
    setActing(true)
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success(`Expense ${action}d.`)
      load()
    } finally { setActing(false) }
  }

  async function reject() {
    const reason = prompt('Reason for rejection?')
    if (!reason) return
    await action('reject', { rejection_reason: reason })
  }

  async function remove() {
    if (!confirm('Delete this expense?')) return
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Deleted.'); router.push('/expenses') }
    else toast.error('Delete failed.')
  }

  if (loading) return <div className="p-6 max-w-3xl"><div className="h-8 w-64 bg-white/5 rounded animate-pulse" /></div>
  if (notFound || !expense) return <div className="p-6"><Link href="/expenses" className="text-[#F47920]">← Back</Link></div>

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <button onClick={() => router.push('/expenses')} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-white font-bold text-xl font-mono">{expense.expense_number}</h1>
            <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', STATUS_COLORS[expense.status])}>{expense.status}</span>
            {expense.is_billable && <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full uppercase">Billable</span>}
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            {expense.crm_users?.full_name} · {fmtDate(expense.expense_date)}
            {expense.crm_projects?.name && ` · Project: ${expense.crm_projects.name}`}
          </p>
        </div>
      </div>

      {/* Status banner */}
      {expense.status === 'rejected' && expense.rejection_reason && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
          <p className="text-red-300 text-xs font-bold uppercase mb-1">Rejected by {expense.approver?.full_name}</p>
          <p className="text-red-200 text-sm">{expense.rejection_reason}</p>
        </div>
      )}
      {expense.status === 'approved' && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-4">
          <p className="text-emerald-300 text-xs">Approved by {expense.approver?.full_name} on {fmtDateTime(expense.approved_at)}</p>
        </div>
      )}
      {expense.status === 'reimbursed' && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-4 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-purple-400" />
          <p className="text-purple-300 text-sm">Reimbursed on {fmtDateTime(expense.reimbursed_at)}</p>
        </div>
      )}

      {/* Details card */}
      <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 mb-4">
        <p className="text-white text-sm mb-4">{expense.description}</p>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <Field label="Amount" value={<span className="text-[#F47920] font-bold text-lg">{fmt(expense.amount, expense.currency)}</span>} />
          <Field label="Category" value={<span className="capitalize">{expense.category.replace('_', ' ')}</span>} />
          <Field label="Submitted" value={fmtDateTime(expense.submitted_at)} />
          <Field label="Reimbursable" value={expense.reimbursable ? 'Yes' : 'No'} />
        </div>
        {expense.receipt_url && (
          <a href={expense.receipt_url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 mt-4 bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-white transition">
            <ExternalLink className="w-3 h-3" /> View Receipt
          </a>
        )}
        {expense.notes && <div className="mt-4 pt-4 border-t border-white/5"><p className="text-slate-400 text-xs">{expense.notes}</p></div>}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {expense.status === 'draft' && (
          <>
            <button onClick={() => action('submit')} disabled={acting} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] text-white font-semibold px-5 py-2 rounded-lg text-sm">
              <Send className="w-4 h-4" /> Submit for Approval
            </button>
            <button onClick={remove} className="flex items-center gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 px-4 py-2 rounded-lg text-sm">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </>
        )}
        {expense.status === 'submitted' && (
          <>
            <button onClick={() => action('approve')} disabled={acting} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-5 py-2 rounded-lg text-sm">
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Approve
            </button>
            <button onClick={reject} disabled={acting} className="flex items-center gap-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 font-semibold px-5 py-2 rounded-lg text-sm">
              <XCircle className="w-4 h-4" /> Reject
            </button>
          </>
        )}
        {expense.status === 'rejected' && (
          <button onClick={() => action('submit')} disabled={acting} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] text-white font-semibold px-5 py-2 rounded-lg text-sm">
            <Send className="w-4 h-4" /> Re-submit
          </button>
        )}
        {expense.status === 'approved' && (
          <button onClick={() => action('reimburse')} disabled={acting} className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white font-semibold px-5 py-2 rounded-lg text-sm">
            <Wallet className="w-4 h-4" /> Mark Reimbursed
          </button>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="text-slate-500 uppercase tracking-wide text-[10px] font-semibold mb-1">{label}</p><p className="text-white">{value}</p></div>
}
