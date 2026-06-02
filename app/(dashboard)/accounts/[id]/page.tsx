'use client'
import { use } from 'react'
import DetailShell, { inputCls, labelCls } from '@/components/DetailShell'
import clsx from 'clsx'

import Select from '@/components/ui/Select'
import { GST_STATE_CODES, isValidGstin } from '@/lib/money'

type Account = {
  id: string; name: string; website: string; industry: string
  account_type: string; phone: string; email: string
  annual_revenue: number | null; employee_count: number | null
  notes: string; tags: string[]; created_at: string
  crm_users: { full_name: string } | null
  // Tax + structured billing address
  gstin: string | null
  billing_address_line1: string | null
  billing_address_line2: string | null
  billing_city: string | null
  billing_state: string | null
  billing_state_code: string | null
  billing_pincode: string | null
  billing_country: string | null
}

const STATE_OPTIONS = [
  { value: '', label: '— Select state —' },
  ...Object.entries(GST_STATE_CODES)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, name]) => ({ value: code, label: `${name} (${code})` })),
]

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
      validate={f => {
        if (!f.name?.trim()) return 'Name is required.'
        if (f.gstin && !isValidGstin(f.gstin)) return 'GSTIN format is invalid. Leave blank for B2C accounts.'
        return null
      }}
    >
      {(_r, form, update) => {
        const gstinTouched = !!form.gstin
        const gstinOk = !gstinTouched || isValidGstin(form.gstin!)
        return (
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

            {/* ── GST + structured billing address ─────────────────── */}
            <div className="sm:col-span-2 pt-3 pb-1 text-xs font-semibold text-slate-300 uppercase tracking-wide border-b border-white/10">Tax + Billing Address</div>
            <div className="sm:col-span-2">
              <label className={labelCls}>GSTIN <span className="text-slate-500 font-normal normal-case">(leave blank for B2C)</span></label>
              <input
                className={clsx(inputCls, gstinTouched && !gstinOk && 'border-red-500/60')}
                placeholder="06AAICI5025Q1Z6"
                maxLength={15}
                value={form.gstin ?? ''}
                onChange={e => update('gstin', e.target.value.toUpperCase() as unknown as never)}
              />
              {gstinTouched && !gstinOk && (
                <p className="text-xs text-red-400 mt-1">Invalid GSTIN format (15 chars, state-code + PAN + entity + Z + checksum).</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Address Line 1</label>
              <input className={inputCls} value={form.billing_address_line1 ?? ''} onChange={e => update('billing_address_line1', e.target.value as unknown as never)} placeholder="Plot 45, Industrial Area" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Address Line 2</label>
              <input className={inputCls} value={form.billing_address_line2 ?? ''} onChange={e => update('billing_address_line2', e.target.value as unknown as never)} placeholder="Phase II (optional)" />
            </div>
            <div>
              <label className={labelCls}>City</label>
              <input className={inputCls} value={form.billing_city ?? ''} onChange={e => update('billing_city', e.target.value as unknown as never)} />
            </div>
            <div>
              <label className={labelCls}>State</label>
              <Select
                value={form.billing_state_code ?? ''}
                onValueChange={v => {
                  update('billing_state_code', v as unknown as never)
                  // Auto-fill the state name from the code so the snapshot
                  // on future invoices has a human label.
                  update('billing_state', (GST_STATE_CODES[v] ?? null) as unknown as never)
                }}
                options={STATE_OPTIONS}
              />
            </div>
            <div>
              <label className={labelCls}>PIN Code</label>
              <input
                className={inputCls}
                maxLength={6}
                value={form.billing_pincode ?? ''}
                onChange={e => update('billing_pincode', e.target.value.replace(/\D/g, '') as unknown as never)}
                placeholder="122001"
              />
            </div>
            <div>
              <label className={labelCls}>Country</label>
              <input className={inputCls} value={form.billing_country ?? 'India'} onChange={e => update('billing_country', e.target.value as unknown as never)} />
            </div>

            <div className="sm:col-span-2"><label className={labelCls}>Notes</label>
              <textarea className={clsx(inputCls, 'min-h-[100px] resize-y')} value={form.notes ?? ''} onChange={e => update('notes', e.target.value)} /></div>
          </div>
        )
      }}
    </DetailShell>
  )
}
