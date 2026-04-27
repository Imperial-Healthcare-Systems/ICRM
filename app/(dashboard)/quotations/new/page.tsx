'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import LineItemsEditor, { LineItem, computeTotals } from '@/components/LineItemsEditor'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

type Account = { id: string; name: string }
type Contact = { id: string; first_name: string; last_name: string }

export default function NewQuotationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [items, setItems] = useState<LineItem[]>([])
  const [taxPct, setTaxPct] = useState(18)
  const [discountPct, setDiscountPct] = useState(0)
  const [form, setForm] = useState({
    account_id: '', contact_id: '', valid_until: '', currency: 'INR',
    notes: '', terms: 'Payment due within 30 days of invoice date.',
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/accounts?pageSize=100').then(r => r.json()),
      fetch('/api/contacts?pageSize=100').then(r => r.json()),
    ]).then(([a, c]) => {
      setAccounts(a.data ?? [])
      setContacts(c.data ?? [])
    })
  }, [])

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (items.length === 0) { toast.error('Add at least one line item.'); return }
    setLoading(true)

    const { subtotal, total } = computeTotals(items, discountPct, taxPct)

    try {
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          account_id: form.account_id || null,
          contact_id: form.contact_id || null,
          valid_until: form.valid_until || null,
          items,
          subtotal,
          discount_pct: discountPct,
          tax_pct: taxPct,
          total,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success(`Quotation ${data.data.quote_number} created!`)
      router.push('/quotations')
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
      <PageHeader title="New Quotation" backHref="/quotations" />
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Header details */}
        <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6">
          <h3 className="text-slate-300 text-sm font-semibold mb-4">Client Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Account</label>
              <select className={inputCls} value={form.account_id} onChange={e => update('account_id', e.target.value)}>
                <option value="">Select account</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Contact</label>
              <select className={inputCls} value={form.contact_id} onChange={e => update('contact_id', e.target.value)}>
                <option value="">Select contact</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name ?? ''}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Valid Until</label>
              <input type="date" className={inputCls} value={form.valid_until} onChange={e => update('valid_until', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <select className={inputCls} value={form.currency} onChange={e => update('currency', e.target.value)}>
                {['INR','USD','EUR','GBP','AED'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6">
          <LineItemsEditor
            items={items}
            onChange={setItems}
            taxPct={taxPct}
            onTaxChange={setTaxPct}
            discountPct={discountPct}
            onDiscountChange={setDiscountPct}
            currency={form.currency}
          />
        </div>

        {/* Notes & Terms */}
        <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Notes (visible to client)</label>
            <textarea rows={3} className={inputCls} placeholder="Any notes for the client…" value={form.notes} onChange={e => update('notes', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Terms & Conditions</label>
            <textarea rows={3} className={inputCls} value={form.terms} onChange={e => update('terms', e.target.value)} />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Saving…' : 'Create Quotation'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
