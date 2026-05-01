'use client'

import { useEffect, useState, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Loader2, Brain, UserCheck, Trash2, Mail, Phone, Building2,
  Briefcase, Tag, Save, Flame, Thermometer, Snowflake, Star,
} from 'lucide-react'
import clsx from 'clsx'

import Select from '@/components/ui/Select'
type Lead = {
  id: string; first_name: string; last_name: string; email: string
  phone: string; company: string; job_title: string; lead_source: string
  lead_status: string; rating: string; ai_score: number | null
  notes: string; tags: string[]; created_at: string; updated_at: string
  converted_to: string | null; converted_at: string | null
  crm_users: { id: string; full_name: string; email: string } | null
  crm_contacts: { id: string; first_name: string; last_name: string } | null
}

const STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'unqualified', 'converted', 'recycled']
const RATING_OPTIONS = ['hot', 'warm', 'cold']
const SOURCE_OPTIONS = ['', 'website', 'referral', 'social_media', 'cold_call', 'event', 'advertisement', 'other']

const STATUS_COLORS: Record<string, string> = {
  new:         'bg-blue-500/20 text-blue-400 border-blue-500/30',
  contacted:   'bg-purple-500/20 text-purple-400 border-purple-500/30',
  qualified:   'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  unqualified: 'bg-red-500/20 text-red-400 border-red-500/30',
  converted:   'bg-orange-500/20 text-orange-400 border-orange-500/30',
  recycled:    'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
}

function RatingIcon({ rating }: { rating: string }) {
  if (rating === 'hot') return <Flame className="w-4 h-4 text-red-400" />
  if (rating === 'warm') return <Thermometer className="w-4 h-4 text-orange-400" />
  return <Snowflake className="w-4 h-4 text-blue-400" />
}

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [lead, setLead] = useState<Lead | null>(null)
  const [form, setForm] = useState<Partial<Lead>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scoring, setScoring] = useState(false)
  const [converting, setConverting] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/leads/${id}`)
      if (res.status === 404) { setNotFound(true); return }
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to load lead.'); return }
      setLead(data.data)
      setForm(data.data)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  function update(k: keyof Lead, v: unknown) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function save() {
    if (!form.first_name?.trim()) { toast.error('First name is required.'); return }
    setSaving(true)
    try {
      const payload: Partial<Lead> = {
        first_name: form.first_name?.trim(),
        last_name: form.last_name?.trim() || null as unknown as string,
        email: form.email?.trim().toLowerCase() || null as unknown as string,
        phone: form.phone?.trim() || null as unknown as string,
        company: form.company?.trim() || null as unknown as string,
        job_title: form.job_title?.trim() || null as unknown as string,
        lead_source: form.lead_source || null as unknown as string,
        lead_status: form.lead_status,
        rating: form.rating,
        notes: form.notes?.trim() || null as unknown as string,
      }
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Save failed.'); return }
      toast.success('Lead updated.')
      load()
    } finally {
      setSaving(false)
    }
  }

  async function runScore() {
    setScoring(true)
    try {
      const res = await fetch(`/api/leads/${id}/score`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Scoring failed.'); return }
      toast.success(`AI Score: ${data.score} — ${data.reason}`)
      load()
    } finally {
      setScoring(false)
    }
  }

  async function convert() {
    if (!confirm('Convert this lead to a Contact? An Account will be created if one matching the company name does not exist.')) return
    setConverting(true)
    try {
      const res = await fetch(`/api/leads/${id}/convert`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Conversion failed.'); return }
      toast.success('Lead converted to Contact!')
      load()
    } finally {
      setConverting(false)
    }
  }

  async function remove() {
    if (!confirm('Delete this lead permanently? This cannot be undone.')) return
    const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Lead deleted.'); router.push('/leads') }
    else toast.error('Delete failed.')
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

  if (notFound || !lead) {
    return <div className="p-6 max-w-2xl">
      <div className="bg-[#0D1B2E] border border-red-500/20 rounded-xl p-8 text-center">
        <p className="text-white font-semibold mb-2">Lead not found</p>
        <p className="text-slate-500 text-sm mb-4">It may have been deleted or you don&apos;t have access.</p>
        <Link href="/leads" className="text-[#F47920] text-sm font-semibold hover:underline">← Back to leads</Link>
      </div>
    </div>
  }

  const isConverted = lead.lead_status === 'converted'
  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 focus:ring-1 focus:ring-[#F47920]/20 transition disabled:opacity-50'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/leads')} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-white font-bold text-xl">{lead.first_name} {lead.last_name ?? ''}</h1>
            <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border', STATUS_COLORS[lead.lead_status])}>
              {lead.lead_status}
            </span>
            <RatingIcon rating={lead.rating} />
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            Created {new Date(lead.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            {lead.crm_users?.full_name && ` · Assigned to ${lead.crm_users.full_name}`}
          </p>
        </div>
        {isConverted && lead.crm_contacts && (
          <Link href={`/contacts`} className="text-xs font-semibold text-orange-400 hover:underline flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5" /> Converted to {lead.crm_contacts.first_name} {lead.crm_contacts.last_name}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Profile fields */}
          <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6">
            <h2 className="text-white font-semibold text-sm mb-4">Profile</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>First Name *</label>
                <input className={inputCls} value={form.first_name ?? ''} onChange={e => update('first_name', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Last Name</label>
                <input className={inputCls} value={form.last_name ?? ''} onChange={e => update('last_name', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}><Mail className="w-3 h-3 inline mr-1" />Email</label>
                <input type="email" className={inputCls} value={form.email ?? ''} onChange={e => update('email', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}><Phone className="w-3 h-3 inline mr-1" />Phone</label>
                <input className={inputCls} value={form.phone ?? ''} onChange={e => update('phone', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}><Building2 className="w-3 h-3 inline mr-1" />Company</label>
                <input className={inputCls} value={form.company ?? ''} onChange={e => update('company', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}><Briefcase className="w-3 h-3 inline mr-1" />Job Title</label>
                <input className={inputCls} value={form.job_title ?? ''} onChange={e => update('job_title', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Lead Source</label>
                <Select value={form.lead_source ?? ''} onValueChange={v => update('lead_source', v)}
              options={SOURCE_OPTIONS.map(s => ({ value: s, label: s ? s.replace(/_/g, ' ') : 'Not set' }))} />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <Select value={form.lead_status ?? ''} onValueChange={v => update('lead_status', v)} disabled={isConverted}
              options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Notes</label>
                <textarea className={clsx(inputCls, 'min-h-[100px] resize-y')} value={form.notes ?? ''} onChange={e => update('notes', e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm transition">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button onClick={remove} className="flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 font-medium px-5 py-2 rounded-lg text-sm transition">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        </div>

        {/* Side column */}
        <div className="space-y-4">
          {/* AI Score */}
          <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-slate-300 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" /> AI Score
              </h3>
              <span className="text-[9px] font-bold text-[#F47920] bg-[#F47920]/15 px-2 py-0.5 rounded-full">1 CREDIT</span>
            </div>
            {lead.ai_score !== null ? (
              <div>
                <p className={clsx(
                  'text-4xl font-black mb-1',
                  lead.ai_score >= 70 ? 'text-emerald-400' :
                  lead.ai_score >= 40 ? 'text-yellow-400' : 'text-red-400'
                )}>{lead.ai_score}</p>
                <p className="text-slate-500 text-xs">out of 100</p>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Not scored yet</p>
            )}
            <button onClick={runScore} disabled={scoring} className="w-full mt-3 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-slate-300 hover:text-white text-xs font-semibold py-2 rounded-lg transition">
              {scoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
              {scoring ? 'Scoring…' : lead.ai_score !== null ? 'Re-score' : 'Run AI Score'}
            </button>
          </div>

          {/* Convert */}
          {!isConverted && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
              <h3 className="text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" /> Convert
              </h3>
              <p className="text-slate-400 text-xs mb-3 leading-relaxed">Turn this lead into a Contact and (optionally) an Account.</p>
              <button onClick={convert} disabled={converting} className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-xs transition">
                {converting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                {converting ? 'Converting…' : 'Convert to Contact'}
              </button>
            </div>
          )}

          {/* Rating */}
          <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-5">
            <h3 className="text-slate-300 text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5" /> Rating
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {RATING_OPTIONS.map(r => (
                <button
                  key={r}
                  onClick={() => update('rating', r)}
                  className={clsx(
                    'flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold capitalize border transition',
                    form.rating === r
                      ? 'bg-[#F47920]/15 text-[#F47920] border-[#F47920]/40'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  )}
                >
                  <RatingIcon rating={r} />
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          {lead.tags?.length > 0 && (
            <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-5">
              <h3 className="text-slate-300 text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Tags
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {lead.tags.map(t => <span key={t} className="text-[10px] bg-white/5 text-slate-300 px-2 py-0.5 rounded-full">{t}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
