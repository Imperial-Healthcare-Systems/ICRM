'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import {
  Zap, CreditCard, TrendingUp, TrendingDown, CheckCircle,
  Loader2, ArrowUpRight, ArrowDownLeft, Clock, Package,
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const PACKAGES = [
  {
    id: 'starter',
    label: 'Starter',
    credits: 50,
    price: 499,
    tag: null,
    perCredit: '₹9.98',
    features: ['50 AI credits', 'Email drafts (50×)', 'Summaries (50×)', 'Valid forever'],
  },
  {
    id: 'growth',
    label: 'Growth',
    credits: 150,
    price: 1299,
    tag: 'Most Popular',
    perCredit: '₹8.66',
    features: ['150 AI credits', 'Best for teams', 'Sales insights (75×)', 'Valid forever'],
  },
  {
    id: 'professional',
    label: 'Professional',
    credits: 500,
    price: 3999,
    tag: 'Best Value',
    perCredit: '₹7.99',
    features: ['500 AI credits', 'Maximum savings', 'Full AI suite access', 'Valid forever'],
  },
] as const

type Transaction = {
  id: string
  feature_key: string
  amount: number
  direction: 'credit' | 'debit'
  description: string | null
  created_at: string
}

declare global {
  interface Window {
    Cashfree?: (cfg: { mode: string }) => {
      checkout: (opts: { paymentSessionId: string; redirectTarget?: string }) => void
    }
  }
}

export default function BillingPage() {
  const searchParams = useSearchParams()
  const [balance, setBalance] = useState<number | null>(null)
  const [totalPurchased, setTotalPurchased] = useState(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState<string | null>(null)
  const [sdkReady, setSdkReady] = useState(false)

  // Show success/failure toast after Cashfree redirect
  useEffect(() => {
    const status = searchParams.get('status')
    const orderId = searchParams.get('order_id')
    if (!status || !orderId) return

    if (status === 'SUCCESS') {
      toast.success('Payment successful! Credits have been added.')
      // Poll verify endpoint to confirm
      fetch(`/api/billing/verify/${orderId}`).then(r => r.json()).then(d => {
        if (d.currentBalance !== undefined) setBalance(d.currentBalance)
      })
    } else if (status === 'FAILED') {
      toast.error('Payment failed. Please try again.')
    }
    // Remove query params from URL without reload
    window.history.replaceState({}, '', '/billing')
  }, [searchParams])

  const fetchData = useCallback(() => {
    fetch('/api/billing').then(r => r.json()).then(d => {
      setBalance(d.balance ?? 0)
      setTotalPurchased(d.totalPurchased ?? 0)
      setTransactions(d.transactions ?? [])
      setLoading(false)
    })
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Load Cashfree SDK
  useEffect(() => {
    if (window.Cashfree) { setSdkReady(true); return }
    const script = document.createElement('script')
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js'
    script.onload = () => setSdkReady(true)
    document.head.appendChild(script)
  }, [])

  async function handleBuy(packageId: string) {
    setBuying(packageId)
    try {
      const res = await fetch('/api/billing/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to initiate payment'); return }

      if (!window.Cashfree || !sdkReady) {
        toast.error('Payment SDK not loaded. Please refresh.')
        return
      }

      const mode = process.env.NEXT_PUBLIC_CASHFREE_MODE === 'production' ? 'production' : 'sandbox'
      const cf = window.Cashfree({ mode })
      cf.checkout({ paymentSessionId: data.paymentSessionId, redirectTarget: '_self' })
    } catch {
      toast.error('Something went wrong.')
    } finally {
      setBuying(null)
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  const featureLabel = (key: string) => {
    const map: Record<string, string> = {
      credit_purchase: 'Credit Top-up',
      ai_summarize:    'AI Summarize',
      ai_draft_email:  'AI Draft Email',
      ai_insights:     'AI Insights',
      ai_lead_scoring: 'AI Lead Scoring',
    }
    return map[key] ?? key.replace(/_/g, ' ')
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <PageHeader title="Billing & Credits" subtitle="Manage your Imperial Intelligence AI credits" />

      {/* Balance card */}
      <div className="bg-gradient-to-r from-[#0D1B2E] to-[#0f2744] border border-[#F47920]/20 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#F47920]/15 flex items-center justify-center">
            <Zap className="w-7 h-7 text-[#F47920]" />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Available AI Credits</p>
            <p className="text-white text-4xl font-black">
              {loading ? '—' : balance?.toLocaleString()}
            </p>
            <p className="text-slate-500 text-xs mt-0.5">
              {loading ? '' : `${totalPurchased.toLocaleString()} total purchased`}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'Summarize', cost: '1 cr', icon: <Package className="w-3.5 h-3.5" /> },
            { label: 'Draft Email', cost: '1 cr', icon: <CreditCard className="w-3.5 h-3.5" /> },
            { label: 'Insights', cost: '2 cr', icon: <Zap className="w-3.5 h-3.5" /> },
          ].map(item => (
            <div key={item.label} className="bg-white/5 rounded-xl px-3 py-2">
              <div className="flex items-center justify-center gap-1 text-[#F47920] mb-1">{item.icon}</div>
              <p className="text-white text-xs font-semibold">{item.label}</p>
              <p className="text-slate-500 text-[10px]">{item.cost}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Credit packages */}
      <div>
        <h2 className="text-white font-semibold mb-1">Top Up Credits</h2>
        <p className="text-slate-500 text-xs mb-4">One-time purchase · Credits never expire · Instant activation</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PACKAGES.map(pkg => (
            <div key={pkg.id} className={clsx(
              'bg-[#0D1B2E] border rounded-2xl p-5 relative flex flex-col',
              pkg.tag === 'Most Popular' ? 'border-[#F47920]/40' : 'border-white/5'
            )}>
              {pkg.tag && (
                <span className={clsx(
                  'absolute -top-2.5 left-4 text-[10px] font-bold px-3 py-0.5 rounded-full',
                  pkg.tag === 'Best Value' ? 'bg-emerald-500 text-white' : 'bg-[#F47920] text-white'
                )}>
                  {pkg.tag}
                </span>
              )}
              <div className="mb-4">
                <p className="text-white font-bold text-lg">{pkg.label}</p>
                <div className="flex items-end gap-2 mt-1">
                  <p className="text-[#F47920] text-3xl font-black">{pkg.credits}</p>
                  <p className="text-slate-400 text-sm mb-1">credits</p>
                </div>
                <p className="text-slate-500 text-xs">{pkg.perCredit} per credit</p>
              </div>
              <ul className="space-y-1.5 mb-5 flex-1">
                {pkg.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-slate-300 text-xs">
                    <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleBuy(pkg.id)}
                disabled={!!buying}
                className="flex items-center justify-center gap-2 w-full bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-sm transition"
              >
                {buying === pkg.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                {buying === pkg.id ? 'Processing…' : `Buy for ${fmt(pkg.price)}`}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction history */}
      <div className="bg-[#0D1B2E] border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-slate-400" />
          <h3 className="text-white font-semibold">Credit History</h3>
        </div>
        {loading ? (
          <div className="h-32 bg-white/3 rounded-xl animate-pulse" />
        ) : transactions.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-8">No credit transactions yet.</p>
        ) : (
          <div className="space-y-1">
            {transactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'w-7 h-7 rounded-lg flex items-center justify-center',
                    tx.direction === 'credit' ? 'bg-emerald-500/10' : 'bg-red-500/10'
                  )}>
                    {tx.direction === 'credit'
                      ? <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                      : <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{featureLabel(tx.feature_key)}</p>
                    {tx.description && <p className="text-slate-500 text-xs">{tx.description}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className={clsx(
                    'font-bold text-sm',
                    tx.direction === 'credit' ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {tx.direction === 'credit' ? '+' : '−'}{tx.amount}
                  </p>
                  <p className="text-slate-600 text-xs">{fmtDate(tx.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
