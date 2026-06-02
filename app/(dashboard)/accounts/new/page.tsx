'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import Select from '@/components/ui/Select'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { GST_STATE_CODES, isValidGstin } from '@/lib/money'

// State name → state code map for the dropdown.
// Sorted by code so India's geography stays roughly stable in the list.
const STATE_OPTIONS = Object.entries(GST_STATE_CODES)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([code, name]) => ({ value: code, label: `${name} (${code})` }))

export default function NewAccountPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', website: '', industry: '', account_type: 'prospect',
    phone: '', email: '', annual_revenue: '', employee_count: '',
    // GST + structured billing address
    gstin: '',
    billing_address_line1: '',
    billing_address_line2: '',
    billing_city: '',
    billing_state_code: '',  // 2-digit code; state name is derived for display
    billing_pincode: '',
    billing_country: 'India',
  })

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // Live GSTIN format check — soft warning, doesn't block save (B2C accounts).
  const gstinTouched = form.gstin.length > 0
  const gstinOk = !gstinTouched || isValidGstin(form.gstin.toUpperCase())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (gstinTouched && !gstinOk) {
      toast.error('GSTIN format is invalid. Leave blank for B2C accounts.')
      return
    }
    setLoading(true)
    try {
      const billingStateName =
        form.billing_state_code ? GST_STATE_CODES[form.billing_state_code] : null
      const gstinClean = form.gstin.trim().toUpperCase() || null

      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:           form.name,
          website:        form.website || null,
          industry:       form.industry || null,
          account_type:   form.account_type,
          phone:          form.phone || null,
          email:          form.email || null,
          annual_revenue: form.annual_revenue ? Number(form.annual_revenue) : null,
          employee_count: form.employee_count ? Number(form.employee_count) : null,
          gstin:                  gstinClean,
          billing_address_line1:  form.billing_address_line1 || null,
          billing_address_line2:  form.billing_address_line2 || null,
          billing_city:           form.billing_city || null,
          billing_state:          billingStateName,
          billing_state_code:     form.billing_state_code || null,
          billing_pincode:        form.billing_pincode || null,
          billing_country:        form.billing_country || 'India',
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Account created!')
      router.push('/accounts')
    } catch {
      toast.error('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 focus:ring-1 focus:ring-[#F47920]/20 transition'
  const inputErrCls = inputCls.replace('border-white/10', 'border-red-500/60')
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'
  const sectionHeader = 'text-xs font-semibold text-slate-300 uppercase tracking-wide mt-2 pb-1 border-b border-white/10'

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader title="New Account" backHref="/accounts" />
      <form onSubmit={handleSubmit} className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 space-y-5">
        {/* ── Company basics ────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>Company Name *</label>
            <input required className={inputCls} placeholder="Acme Corp" value={form.name} onChange={e => update('name', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Website</label>
            <input className={inputCls} placeholder="https://acme.com" value={form.website} onChange={e => update('website', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Industry</label>
            <input className={inputCls} placeholder="Technology" value={form.industry} onChange={e => update('industry', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Account Type</label>
            <Select value={form.account_type} onValueChange={v => update('account_type', v)}
              options={['prospect','customer','partner','vendor','other'].map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))} />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input className={inputCls} placeholder="+91 11 2345 6789" value={form.phone} onChange={e => update('phone', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" className={inputCls} placeholder="info@acme.com" value={form.email} onChange={e => update('email', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Annual Revenue (₹)</label>
            <input type="number" className={inputCls} placeholder="5000000" value={form.annual_revenue} onChange={e => update('annual_revenue', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Employee Count</label>
            <input type="number" className={inputCls} placeholder="50" value={form.employee_count} onChange={e => update('employee_count', e.target.value)} />
          </div>
        </div>

        {/* ── GST + billing address (Tax Invoice fields) ──────────── */}
        <div className={sectionHeader}>Tax + Billing Address</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>
              GSTIN <span className="text-slate-500 font-normal normal-case">(leave blank for B2C / unregistered)</span>
            </label>
            <input
              className={gstinTouched && !gstinOk ? inputErrCls : inputCls}
              placeholder="06AAICI5025Q1Z6"
              maxLength={15}
              value={form.gstin}
              onChange={e => update('gstin', e.target.value.toUpperCase())}
            />
            {gstinTouched && !gstinOk && (
              <p className="text-xs text-red-400 mt-1">
                Invalid GSTIN format. Expected 15 characters: 2-digit state code + 5-letter PAN prefix + 4-digit PAN serial + 1-letter PAN check + 1-char entity + ‘Z’ + 1-char checksum.
              </p>
            )}
          </div>

          <div className="col-span-2">
            <label className={labelCls}>Address Line 1</label>
            <input className={inputCls} placeholder="Plot 45, Industrial Area" value={form.billing_address_line1} onChange={e => update('billing_address_line1', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Address Line 2</label>
            <input className={inputCls} placeholder="Phase II (optional)" value={form.billing_address_line2} onChange={e => update('billing_address_line2', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>City</label>
            <input className={inputCls} placeholder="Gurugram" value={form.billing_city} onChange={e => update('billing_city', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>State</label>
            <Select
              value={form.billing_state_code}
              onValueChange={v => update('billing_state_code', v)}
              options={[{ value: '', label: '— Select state —' }, ...STATE_OPTIONS]}
            />
          </div>
          <div>
            <label className={labelCls}>PIN Code</label>
            <input className={inputCls} placeholder="122001" maxLength={6} value={form.billing_pincode} onChange={e => update('billing_pincode', e.target.value.replace(/\D/g, ''))} />
          </div>
          <div>
            <label className={labelCls}>Country</label>
            <input className={inputCls} value={form.billing_country} onChange={e => update('billing_country', e.target.value)} />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Saving…' : 'Create Account'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
