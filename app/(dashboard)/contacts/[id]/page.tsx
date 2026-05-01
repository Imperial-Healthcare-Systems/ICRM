'use client'

import { useEffect, useState, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Loader2, Trash2, Mail, Phone, Smartphone, Building2,
  Briefcase, Tag, Save, ShieldOff, UserCircle,
} from 'lucide-react'
import clsx from 'clsx'

import Select from '@/components/ui/Select'
type Account = { id: string; name: string }
type Contact = {
  id: string; first_name: string; last_name: string; email: string
  phone: string; mobile: string; job_title: string; department: string
  contact_source: string; lead_status: string; notes: string
  tags: string[]; do_not_contact: boolean; synced_from_hrms: boolean
  account_id: string | null; created_at: string; updated_at: string
  crm_users: { id: string; full_name: string } | null
  crm_accounts: { id: string; name: string } | null
}

const STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'unqualified', 'converted']
const SOURCE_OPTIONS = ['', 'website', 'referral', 'social_media', 'cold_call', 'event', 'lead_conversion', 'other']

const STATUS_COLORS: Record<string, string> = {
  new:         'bg-blue-500/20 text-blue-400 border-blue-500/30',
  contacted:   'bg-purple-500/20 text-purple-400 border-purple-500/30',
  qualified:   'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  unqualified: 'bg-red-500/20 text-red-400 border-red-500/30',
  converted:   'bg-orange-500/20 text-orange-400 border-orange-500/30',
}

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [contact, setContact] = useState<Contact | null>(null)
  const [form, setForm] = useState<Partial<Contact>>({})
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/contacts/${id}`)
      if (res.status === 404) { setNotFound(true); return }
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to load contact.'); return }
      setContact(data.data)
      setForm(data.data)
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetch('/api/accounts?pageSize=200').then(r => r.json()).then(d => setAccounts(d.data ?? []))
  }, [])

  function update(k: keyof Contact, v: unknown) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    if (!form.first_name?.trim()) { toast.error('First name is required.'); return }
    setSaving(true)
    try {
      const payload: Partial<Contact> = {
        first_name: form.first_name?.trim(),
        last_name: form.last_name?.trim() || null as unknown as string,
        email: form.email?.trim().toLowerCase() || null as unknown as string,
        phone: form.phone?.trim() || null as unknown as string,
        mobile: form.mobile?.trim() || null as unknown as string,
        job_title: form.job_title?.trim() || null as unknown as string,
        department: form.department?.trim() || null as unknown as string,
        contact_source: form.contact_source || null as unknown as string,
        lead_status: form.lead_status,
        notes: form.notes?.trim() || null as unknown as string,
        do_not_contact: form.do_not_contact,
        account_id: form.account_id || null,
      }
      const res = await fetch(`/api/contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Save failed.'); return }
      toast.success('Contact updated.')
      load()
    } finally { setSaving(false) }
  }

  async function remove() {
    if (!confirm('Delete this contact permanently? Linked deals/activities will lose their contact reference.')) return
    const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Contact deleted.'); router.push('/contacts') }
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

  if (notFound || !contact) {
    return <div className="p-6 max-w-2xl">
      <div className="bg-[#0D1B2E] border border-red-500/20 rounded-xl p-8 text-center">
        <p className="text-white font-semibold mb-2">Contact not found</p>
        <p className="text-slate-500 text-sm mb-4">It may have been deleted or you don&apos;t have access.</p>
        <Link href="/contacts" className="text-[#F47920] text-sm font-semibold hover:underline">← Back to contacts</Link>
      </div>
    </div>
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 focus:ring-1 focus:ring-[#F47920]/20 transition disabled:opacity-50'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/contacts')} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-12 h-12 rounded-full bg-[#F47920]/20 flex items-center justify-center text-[#F47920] font-bold">
          {(contact.first_name?.[0] ?? '?').toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-white font-bold text-xl">{contact.first_name} {contact.last_name ?? ''}</h1>
            {contact.lead_status && (
              <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border', STATUS_COLORS[contact.lead_status] ?? 'bg-white/5 text-slate-400 border-white/10')}>
                {contact.lead_status}
              </span>
            )}
            {contact.do_not_contact && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1">
                <ShieldOff className="w-3 h-3" /> Do Not Contact
              </span>
            )}
            {contact.synced_from_hrms && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-blue-500/15 text-blue-400 border border-blue-500/30">
                Synced from HRMS
              </span>
            )}
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            {contact.job_title ?? 'No title'}{contact.crm_accounts?.name && ` · ${contact.crm_accounts.name}`}
            {contact.crm_users?.full_name && ` · Owner: ${contact.crm_users.full_name}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">
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
                <label className={labelCls}><Phone className="w-3 h-3 inline mr-1" />Work Phone</label>
                <input className={inputCls} value={form.phone ?? ''} onChange={e => update('phone', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}><Smartphone className="w-3 h-3 inline mr-1" />Mobile</label>
                <input className={inputCls} value={form.mobile ?? ''} onChange={e => update('mobile', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}><Briefcase className="w-3 h-3 inline mr-1" />Job Title</label>
                <input className={inputCls} value={form.job_title ?? ''} onChange={e => update('job_title', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Department</label>
                <input className={inputCls} value={form.department ?? ''} onChange={e => update('department', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}><Building2 className="w-3 h-3 inline mr-1" />Account</label>
                <Select value={form.account_id ?? ''} onValueChange={v => update('account_id', v)} placeholder="No account" allowClear clearLabel="No account"
              options={accounts.map(a => ({ value: a.id, label: a.name }))} />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <Select value={form.lead_status ?? ''} onValueChange={v => update('lead_status', v)}
              options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))} />
              </div>
              <div>
                <label className={labelCls}>Source</label>
                <Select value={form.contact_source ?? ''} onValueChange={v => update('contact_source', v)}
              options={SOURCE_OPTIONS.map(s => ({ value: s, label: s ? s.replace(/_/g, ' ') : 'Not set' }))} />
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
          {/* Communication preferences */}
          <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-5">
            <h3 className="text-slate-300 text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <ShieldOff className="w-3.5 h-3.5" /> Communication
            </h3>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-[#F47920] focus:ring-[#F47920]/40"
                checked={form.do_not_contact ?? false}
                onChange={e => update('do_not_contact', e.target.checked)}
              />
              <div>
                <p className="text-white text-xs font-medium">Do not contact</p>
                <p className="text-slate-500 text-[10px] leading-relaxed">Excludes this contact from all email campaigns and automation.</p>
              </div>
            </label>
          </div>

          {/* Account link */}
          {contact.crm_accounts && (
            <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-5">
              <h3 className="text-slate-300 text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Account
              </h3>
              <Link href="/accounts" className="block hover:bg-white/5 -mx-1 px-1 py-1 rounded transition">
                <p className="text-white text-sm font-medium">{contact.crm_accounts.name}</p>
                <p className="text-slate-500 text-[10px]">View account →</p>
              </Link>
            </div>
          )}

          {/* Tags */}
          {contact.tags?.length > 0 && (
            <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-5">
              <h3 className="text-slate-300 text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Tags
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {contact.tags.map(t => <span key={t} className="text-[10px] bg-white/5 text-slate-300 px-2 py-0.5 rounded-full">{t}</span>)}
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-5">
            <h3 className="text-slate-300 text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <UserCircle className="w-3.5 h-3.5" /> Record
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Created</span>
                <span className="text-slate-300">{new Date(contact.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Updated</span>
                <span className="text-slate-300">{new Date(contact.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
