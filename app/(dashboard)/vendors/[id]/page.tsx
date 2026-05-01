'use client'
import { use } from 'react'
import DetailShell, { inputCls, labelCls } from '@/components/DetailShell'
import clsx from 'clsx'

import Select from '@/components/ui/Select'
type Vendor = {
  id: string; name: string; contact_name: string; email: string; phone: string
  website: string; category: string; gstin: string; pan: string
  payment_terms: string; status: string; notes: string; created_at: string
}

const STATUS_OPTIONS = ['active', 'inactive', 'blacklisted']
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400',
  inactive: 'bg-slate-500/15 text-slate-400',
  blacklisted: 'bg-red-500/15 text-red-400',
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <DetailShell<Vendor>
      id={id} apiPath="/api/vendors" backHref="/vendors" entityLabel="vendor"
      title={r => r.name}
      subtitle={r => <>{r.category ?? 'Uncategorized'}{r.contact_name && ` · Contact: ${r.contact_name}`}</>}
      badges={r => (
        <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', STATUS_COLORS[r.status])}>{r.status}</span>
      )}
      validate={f => !f.name?.trim() ? 'Name is required.' : null}
    >
      {(_r, form, update) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><label className={labelCls}>Name *</label>
            <input className={inputCls} value={form.name ?? ''} onChange={e => update('name', e.target.value)} /></div>
          <div><label className={labelCls}>Contact Person</label>
            <input className={inputCls} value={form.contact_name ?? ''} onChange={e => update('contact_name', e.target.value)} /></div>
          <div><label className={labelCls}>Category</label>
            <input className={inputCls} value={form.category ?? ''} onChange={e => update('category', e.target.value)} /></div>
          <div><label className={labelCls}>Email</label>
            <input className={inputCls} value={form.email ?? ''} onChange={e => update('email', e.target.value)} /></div>
          <div><label className={labelCls}>Phone</label>
            <input className={inputCls} value={form.phone ?? ''} onChange={e => update('phone', e.target.value)} /></div>
          <div><label className={labelCls}>Website</label>
            <input className={inputCls} value={form.website ?? ''} onChange={e => update('website', e.target.value)} /></div>
          <div><label className={labelCls}>Status</label>
            <Select value={form.status ?? ''} onValueChange={v => update('status', v)}
              options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))} /></div>
          <div><label className={labelCls}>GSTIN</label>
            <input className={inputCls} value={form.gstin ?? ''} onChange={e => update('gstin', e.target.value)} /></div>
          <div><label className={labelCls}>PAN</label>
            <input className={inputCls} value={form.pan ?? ''} onChange={e => update('pan', e.target.value)} /></div>
          <div><label className={labelCls}>Payment Terms</label>
            <input className={inputCls} value={form.payment_terms ?? ''} onChange={e => update('payment_terms', e.target.value)} placeholder="e.g. Net 30" /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Notes</label>
            <textarea className={clsx(inputCls, 'min-h-[100px] resize-y')} value={form.notes ?? ''} onChange={e => update('notes', e.target.value)} /></div>
        </div>
      )}
    </DetailShell>
  )
}
