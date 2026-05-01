'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'
import { Loader2, Send, Lock } from 'lucide-react'
import clsx from 'clsx'

import Select from '@/components/ui/Select'
type Ticket = {
  id: string; ticket_number: string; title: string; description: string
  status: string; priority: string; type: string
  sla_due_at: string; resolved_at: string; created_at: string
  crm_accounts: { name: string } | null
  crm_contacts: { first_name: string; last_name: string } | null
  crm_users: { full_name: string } | null
}

type Comment = {
  id: string; body: string; is_internal: boolean; created_at: string
  crm_users: { full_name: string } | null
}

const STATUS_OPTIONS = ['open','in_progress','waiting','resolved','closed']
const PRIORITY_OPTIONS = ['low','medium','high','critical']

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-500/20 text-blue-400', in_progress: 'bg-yellow-500/20 text-yellow-400',
  waiting: 'bg-purple-500/20 text-purple-400', resolved: 'bg-emerald-500/20 text-emerald-400',
  closed: 'bg-slate-500/20 text-slate-400',
}

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [updating, setUpdating] = useState(false)

  async function loadTicket() {
    const [t, c] = await Promise.all([
      fetch(`/api/tickets/${id}`).then(r => r.json()),
      fetch(`/api/tickets/${id}/comments`).then(r => r.json()),
    ])
    setTicket(t.data)
    setComments(c.data ?? [])
  }

  useEffect(() => { loadTicket() }, [id])

  async function updateField(field: string, value: string) {
    setUpdating(true)
    await fetch(`/api/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    setUpdating(false)
    loadTicket()
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentBody.trim()) return
    setSubmitting(true)
    const res = await fetch(`/api/tickets/${id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: commentBody, is_internal: isInternal }),
    })
    if (res.ok) {
      setCommentBody('')
      loadTicket()
    } else {
      toast.error('Failed to add comment.')
    }
    setSubmitting(false)
  }

  if (!ticket) return <div className="p-6"><div className="h-8 bg-white/5 rounded animate-pulse w-64" /></div>

  return (
    <div className="p-6 max-w-4xl">
      <PageHeader title={ticket.ticket_number} backHref="/support" />

      <div className="grid grid-cols-3 gap-6">
        {/* Main content */}
        <div className="col-span-3 lg:col-span-2 space-y-4">
          <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6">
            <h2 className="text-white font-semibold text-lg mb-2">{ticket.title}</h2>
            <p className="text-slate-400 text-sm whitespace-pre-wrap">{ticket.description || 'No description provided.'}</p>
          </div>

          {/* Comments */}
          <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6">
            <h3 className="text-slate-300 text-sm font-semibold mb-4">Comments ({comments.length})</h3>
            <div className="space-y-3 mb-4">
              {comments.length === 0 && <p className="text-slate-600 text-sm">No comments yet.</p>}
              {comments.map(c => (
                <div key={c.id} className={clsx('rounded-lg p-3 text-sm', c.is_internal ? 'bg-yellow-500/5 border border-yellow-500/20' : 'bg-white/3 border border-white/5')}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-medium text-xs">{(c.crm_users as { full_name: string } | null)?.full_name ?? 'Unknown'}</span>
                    {c.is_internal && <span className="flex items-center gap-0.5 text-yellow-500 text-[10px] font-semibold"><Lock className="w-2.5 h-2.5" /> Internal</span>}
                    <span className="text-slate-600 text-xs ml-auto">{new Date(c.created_at).toLocaleString('en-IN')}</span>
                  </div>
                  <p className="text-slate-300 whitespace-pre-wrap">{c.body}</p>
                </div>
              ))}
            </div>
            <form onSubmit={submitComment} className="space-y-2">
              <textarea
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 focus:ring-1 focus:ring-[#F47920]/20 transition"
                placeholder="Add a comment…"
                value={commentBody}
                onChange={e => setCommentBody(e.target.value)}
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsInternal(v => !v)}
                  className={clsx('flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition',
                    isInternal ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/5 text-slate-400 hover:bg-white/10')}
                >
                  <Lock className="w-3 h-3" /> Internal Note
                </button>
                <button type="submit" disabled={submitting || !commentBody.trim()}
                  className="flex items-center gap-1.5 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition ml-auto">
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {submitting ? 'Sending…' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="col-span-3 lg:col-span-1 space-y-4">
          <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-5">
            <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-slate-500 text-xs mb-1">Status</p>
                <Select value={ticket.status} onValueChange={v => updateField('status', v)} disabled={updating}
              options={STATUS_OPTIONS.map(s => ({ value: s, label: s.replace('_', ' ') }))} />
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Priority</p>
                <Select value={ticket.priority} onValueChange={v => updateField('priority', v)} disabled={updating}
              options={PRIORITY_OPTIONS.map(p => ({ value: p, label: p }))} />
              </div>
              <div className="pt-1 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Account</span>
                  <span className="text-white">{ticket.crm_accounts?.name ?? '—'}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Contact</span>
                  <span className="text-white">
                    {ticket.crm_contacts ? `${ticket.crm_contacts.first_name} ${ticket.crm_contacts.last_name ?? ''}` : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Assigned</span>
                  <span className="text-white">{(ticket.crm_users as { full_name: string } | null)?.full_name ?? 'Unassigned'}</span>
                </div>
                {ticket.sla_due_at && (
                  <div className="flex justify-between text-slate-400">
                    <span>SLA Due</span>
                    <span className={new Date(ticket.sla_due_at) < new Date() ? 'text-red-400 font-semibold' : 'text-white'}>
                      {new Date(ticket.sla_due_at).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>Created</span>
                  <span className="text-white">{new Date(ticket.created_at).toLocaleDateString('en-IN')}</span>
                </div>
                {ticket.resolved_at && (
                  <div className="flex justify-between text-slate-400">
                    <span>Resolved</span>
                    <span className="text-white">{new Date(ticket.resolved_at).toLocaleDateString('en-IN')}</span>
                  </div>
                )}
              </div>
              <div className="pt-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[ticket.status] ?? ''}`}>
                  {ticket.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
