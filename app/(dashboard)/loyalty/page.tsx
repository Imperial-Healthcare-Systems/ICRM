'use client'

import { useEffect, useState, useCallback } from 'react'
import { Gift, Plus, ChevronLeft, ChevronRight, Star } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type LoyaltyAccount = {
  id: string; tier: string; points_balance: number
  total_earned: number; total_redeemed: number; updated_at: string
  crm_contacts: { first_name: string; last_name: string; email: string } | null
  crm_accounts: { name: string } | null
}

const TIER_COLORS: Record<string, string> = {
  bronze:   'bg-orange-900/30 text-orange-400',
  silver:   'bg-slate-400/20 text-slate-300',
  gold:     'bg-yellow-500/20 text-yellow-400',
  platinum: 'bg-cyan-500/20 text-cyan-300',
}

const TIER_THRESHOLDS = { bronze: 0, silver: 1000, gold: 5000, platinum: 10000 }

export default function LoyaltyPage() {
  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [awardForm, setAwardForm] = useState({ contact_id: '', points: '', description: '', type: 'earn' })
  const [contacts, setContacts] = useState<{id: string; first_name: string; last_name: string}[]>([])
  const pageSize = 20

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/loyalty?page=${page}&pageSize=${pageSize}`)
      const data = await res.json()
      setAccounts(data.data ?? [])
      setCount(data.count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])
  useEffect(() => {
    fetch('/api/contacts?pageSize=100').then(r => r.json()).then(d => setContacts(d.data ?? []))
  }, [])

  async function awardPoints(e: React.FormEvent) {
    e.preventDefault()
    if (!awardForm.contact_id || !awardForm.points) { toast.error('Contact and points are required.'); return }
    const res = await fetch('/api/loyalty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: awardForm.contact_id, points: parseInt(awardForm.points), description: awardForm.description, type: awardForm.type }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error); return }
    toast.success(`${awardForm.type === 'earn' ? 'Awarded' : 'Redeemed'} ${awardForm.points} points! Balance: ${data.balance} (${data.tier})`)
    setShowModal(false)
    setAwardForm({ contact_id: '', points: '', description: '', type: 'earn' })
    fetchAccounts()
  }

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="p-6">
      <PageHeader
        title="Loyalty Program"
        subtitle={`${count} members`}
        actions={
          <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 bg-[#F47920] hover:bg-[#e06810] text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
            <Plus className="w-4 h-4" /> Award Points
          </button>
        }
      />

      {/* Tier legend */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {(Object.entries(TIER_THRESHOLDS) as [string, number][]).map(([tier, pts]) => (
          <div key={tier} className="bg-[#0D1B2E] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-3.5 h-3.5 text-[#F47920]" />
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${TIER_COLORS[tier]}`}>{tier}</span>
            </div>
            <p className="text-slate-500 text-xs">{pts.toLocaleString()}+ pts</p>
          </div>
        ))}
      </div>

      <div className="bg-[#0D1B2E] border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold">Member</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Tier</th>
              <th className="text-right px-4 py-3 font-semibold">Balance</th>
              <th className="text-right px-4 py-3 font-semibold hidden lg:table-cell">Total Earned</th>
              <th className="text-right px-4 py-3 font-semibold hidden lg:table-cell">Redeemed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-4 bg-white/5 rounded animate-pulse" /></td></tr>
            )) : accounts.length === 0 ? (
              <tr><td colSpan={5}>
                <EmptyState icon={<Gift className="w-7 h-7" />} title="No loyalty members yet" description="Award points to contacts to enroll them in the loyalty program." actionLabel="Award Points" onAction={() => setShowModal(true)} />
              </td></tr>
            ) : accounts.map(a => (
              <tr key={a.id} className="hover:bg-white/3 transition">
                <td className="px-4 py-3">
                  <p className="text-white font-medium">
                    {a.crm_contacts ? `${a.crm_contacts.first_name} ${a.crm_contacts.last_name ?? ''}` : a.crm_accounts?.name ?? '—'}
                  </p>
                  {a.crm_contacts?.email && <p className="text-slate-500 text-xs">{a.crm_contacts.email}</p>}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${TIER_COLORS[a.tier] ?? ''}`}>{a.tier}</span>
                </td>
                <td className="px-4 py-3 text-right text-[#F47920] font-bold">{a.points_balance.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-slate-300 hidden lg:table-cell">{a.total_earned.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-slate-500 hidden lg:table-cell">{a.total_redeemed.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <p className="text-slate-500 text-xs">{count} total · Page {page} of {totalPages}</p>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 flex items-center justify-center text-slate-400 transition"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 flex items-center justify-center text-slate-400 transition"><ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Award Points Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0D1B2E] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-white font-semibold text-lg mb-4">Award / Redeem Points</h2>
            <form onSubmit={awardPoints} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Contact *</label>
                <select className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#F47920]/60 transition"
                  value={awardForm.contact_id} onChange={e => setAwardForm(f => ({ ...f, contact_id: e.target.value }))}>
                  <option value="">Select contact</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name ?? ''}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Type</label>
                  <select className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#F47920]/60 transition"
                    value={awardForm.type} onChange={e => setAwardForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="earn">Earn</option>
                    <option value="redeem">Redeem</option>
                    <option value="adjust">Adjust</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Points *</label>
                  <input type="number" min="1" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#F47920]/60 transition"
                    placeholder="100" value={awardForm.points} onChange={e => setAwardForm(f => ({ ...f, points: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
                <input className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 transition"
                  placeholder="Purchase reward, referral bonus…" value={awardForm.description} onChange={e => setAwardForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-[#F47920] hover:bg-[#e06810] text-white font-semibold py-2.5 rounded-lg text-sm transition">Confirm</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-semibold py-2.5 rounded-lg text-sm transition">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
