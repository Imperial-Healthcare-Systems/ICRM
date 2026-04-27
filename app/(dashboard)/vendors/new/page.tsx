'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

export default function NewVendorPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', email: '', phone: '', website: '',
    contact_name: '', category: '', status: 'active',
    address: '', gstin: '', pan: '', notes: '',
  })

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Vendor name is required.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Vendor added!')
      router.push('/vendors')
    } catch {
      toast.error('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 focus:ring-1 focus:ring-[#F47920]/20 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader title="Add Vendor" backHref="/vendors" />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6">
          <h3 className="text-slate-300 text-sm font-semibold mb-4">Vendor Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Vendor Name *</label>
              <input className={inputCls} placeholder="Acme Supplies Pvt Ltd" value={form.name} onChange={e => update('name', e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" className={inputCls} placeholder="vendor@example.com" value={form.email} onChange={e => update('email', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input type="tel" className={inputCls} placeholder="+91 98765 43210" value={form.phone} onChange={e => update('phone', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Contact Person</label>
              <input className={inputCls} placeholder="Primary contact name" value={form.contact_name} onChange={e => update('contact_name', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Website</label>
              <input type="url" className={inputCls} placeholder="https://vendor.com" value={form.website} onChange={e => update('website', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select className={inputCls} value={form.category} onChange={e => update('category', e.target.value)}>
                <option value="">Select category</option>
                {['technology','logistics','marketing','manufacturing','consulting','raw_materials','office_supplies','other'].map(c => (
                  <option key={c} value={c} className="capitalize">{c.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={form.status} onChange={e => update('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="blacklisted">Blacklisted</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6">
          <h3 className="text-slate-300 text-sm font-semibold mb-4">Tax & Compliance</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>GSTIN</label>
              <input className={inputCls} placeholder="22AAAAA0000A1Z5" value={form.gstin} onChange={e => update('gstin', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>PAN</label>
              <input className={inputCls} placeholder="AAAAA0000A" value={form.pan} onChange={e => update('pan', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Address</label>
              <textarea rows={2} className={inputCls} placeholder="Full business address" value={form.address} onChange={e => update('address', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea rows={2} className={inputCls} placeholder="Internal notes about this vendor…" value={form.notes} onChange={e => update('notes', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Saving…' : 'Add Vendor'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition">Cancel</button>
        </div>
      </form>
    </div>
  )
}
