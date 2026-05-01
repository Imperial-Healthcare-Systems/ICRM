'use client'
import { use } from 'react'
import DetailShell, { inputCls, labelCls } from '@/components/DetailShell'
import clsx from 'clsx'

import Select from '@/components/ui/Select'
type Account = {
  id: string; name: string; website: string; industry: string
  account_type: string; phone: string; email: string
  annual_revenue: number | null; employee_count: number | null
  notes: string; tags: string[]; created_at: string
  crm_users: { full_name: string } | null
}

const ACCOUNT_TYPES = ['prospect', 'customer', 'partner', 'vendor', 'other']
const TYPE_COLORS: Record<string, string> = {
  prospect: 'bg-blue-500/15 text-blue-400',
  customer: 'bg-emerald-500/15 text-emerald-400',
  partner: 'bg-purple-500/15 text-purple-400',
  vendor: 'bg-yellow-500/15 text-yellow-400',
  other: 'bg-slate-500/15 text-slate-400',
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <DetailShell<Account>
      id={id} apiPath="/api/accounts" backHref="/accounts" entityLabel="account"
      title={r => r.name}
      subtitle={r => <>{r.industry ?? 'No industry'}{r.crm_users?.full_name && ` · Owner: ${r.crm_users.full_name}`}</>}
      badges={r => (
        <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', TYPE_COLORS[r.account_type] ?? 'bg-white/5 text-slate-400')}>
          {r.account_type}
        </span>
      )}
      validate={f => !f.name?.trim() ? 'Name is required.' : null}
    >
      {(_r, form, update) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><label className={labelCls}>Name *</label>
            <input className={inputCls} value={form.name ?? ''} onChange={e => update('name', e.target.value)} /></div>
          <div><label className={labelCls}>Industry</label>
            <input className={inputCls} value={form.industry ?? ''} onChange={e => update('industry', e.target.value)} /></div>
          <div><label className={labelCls}>Account Type</label>
            <Select value={form.account_type ?? ''} onValueChange={v => update('account_type', v)}
              options={ACCOUNT_TYPES.map(t => ({ value: t, label: t }))} /></div>
          <div><label className={labelCls}>Website</label>
            <input className={inputCls} value={form.website ?? ''} onChange={e => update('website', e.target.value)} placeholder="https://..." /></div>
          <div><label className={labelCls}>Email</label>
            <input className={inputCls} value={form.email ?? ''} onChange={e => update('email', e.target.value)} /></div>
          <div><label className={labelCls}>Phone</label>
            <input className={inputCls} value={form.phone ?? ''} onChange={e => update('phone', e.target.value)} /></div>
          <div><label className={labelCls}>Employees</label>
            <input type="number" className={inputCls} value={form.employee_count ?? ''} onChange={e => update('employee_count', e.target.value ? Number(e.target.value) : null as unknown as number)} /></div>
          <div><label className={labelCls}>Annual Revenue (₹)</label>
            <input type="number" className={inputCls} value={form.annual_revenue ?? ''} onChange={e => update('annual_revenue', e.target.value ? Number(e.target.value) : null as unknown as number)} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Notes</label>
            <textarea className={clsx(inputCls, 'min-h-[100px] resize-y')} value={form.notes ?? ''} onChange={e => update('notes', e.target.value)} /></div>
        </div>
      )}
    </DetailShell>
  )
}
