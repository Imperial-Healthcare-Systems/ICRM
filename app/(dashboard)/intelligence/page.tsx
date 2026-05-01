'use client'

import { useState, useEffect } from 'react'
import PageHeader from '@/components/PageHeader'
import { Brain, Sparkles, Mail, BarChart3, Loader2, Copy, Check, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

import Select from '@/components/ui/Select'
type Deal    = { id: string; title: string }
type Contact = { id: string; first_name: string; last_name: string }
type Account = { id: string; name: string }

type FeatureTab = 'summarize' | 'draft-email' | 'insights'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs transition">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function ResultBox({ text, provider }: { text: string; provider?: string }) {
  return (
    <div className="bg-white/3 border border-white/5 rounded-xl p-5 relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#F47920]" />
          <span className="text-[#F47920] text-xs font-semibold">Imperial Intelligence</span>
          {provider && <span className="text-slate-600 text-xs">via {provider}</span>}
        </div>
        <CopyButton text={text} />
      </div>
      <div className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">{text}</div>
    </div>
  )
}

export default function IntelligencePage() {
  const [activeTab, setActiveTab] = useState<FeatureTab>('summarize')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ text: string; provider: string } | null>(null)
  const [credits, setCredits] = useState<number | null>(null)

  const [deals, setDeals] = useState<Deal[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])

  // Summarize form
  const [sumType, setSumType] = useState<'deal' | 'contact' | 'account'>('deal')
  const [sumId, setSumId] = useState('')

  // Email drafter form
  const [emailPurpose, setEmailPurpose] = useState('')
  const [emailTone, setEmailTone] = useState('professional')
  const [emailContactId, setEmailContactId] = useState('')
  const [emailDealId, setEmailDealId] = useState('')
  const [emailContext, setEmailContext] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/deals?pageSize=50').then(r => r.json()),
      fetch('/api/contacts?pageSize=50').then(r => r.json()),
      fetch('/api/accounts?pageSize=50').then(r => r.json()),
      fetch('/api/billing').then(r => r.json()).catch(() => null),
    ]).then(([d, c, a, billing]) => {
      setDeals(d.data ?? [])
      setContacts(c.data ?? [])
      setAccounts(a.data ?? [])
      if (billing?.balance !== undefined) setCredits(billing.balance)
    })
  }, [])

  function resetResult() { setResult(null) }

  async function runSummarize() {
    if (!sumId) { toast.error('Please select a record to summarize.'); return }
    setLoading(true); resetResult()
    try {
      const res = await fetch('/api/intelligence/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: sumType, id: sumId }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setResult({ text: data.summary, provider: data.provider })
      if (credits !== null) setCredits(c => c !== null ? c - 1 : null)
    } catch { toast.error('Something went wrong.') }
    finally { setLoading(false) }
  }

  async function runDraftEmail() {
    if (!emailPurpose.trim()) { toast.error('Please describe the email purpose.'); return }
    setLoading(true); resetResult()
    try {
      const res = await fetch('/api/intelligence/draft-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: emailPurpose, tone: emailTone,
          contact_id: emailContactId || null,
          deal_id: emailDealId || null,
          extra_context: emailContext,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setResult({ text: data.draft, provider: data.provider })
      if (credits !== null) setCredits(c => c !== null ? c - 1 : null)
    } catch { toast.error('Something went wrong.') }
    finally { setLoading(false) }
  }

  async function runInsights() {
    setLoading(true); resetResult()
    try {
      const res = await fetch('/api/intelligence/insights', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setResult({ text: data.insights, provider: data.provider })
      if (credits !== null) setCredits(c => c !== null ? c - 2 : null)
    } catch { toast.error('Something went wrong.') }
    finally { setLoading(false) }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 focus:ring-1 focus:ring-[#F47920]/20 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  const tabs: { key: FeatureTab; label: string; icon: React.ReactNode; cost: number; desc: string }[] = [
    { key: 'summarize',   label: 'Summarize',     icon: <Brain className="w-4 h-4" />,    cost: 1, desc: 'Get an AI summary of any deal, contact, or account with actionable next steps.' },
    { key: 'draft-email', label: 'Draft Email',   icon: <Mail className="w-4 h-4" />,     cost: 1, desc: 'Generate a personalized, professional sales email in seconds.' },
    { key: 'insights',    label: 'Sales Insights',icon: <BarChart3 className="w-4 h-4" />,cost: 2, desc: 'Get AI-powered strategic insights based on your last 30 days of CRM data.' },
  ]

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-5 h-5 text-[#F47920]" />
            <h1 className="text-white font-bold text-xl">Imperial Intelligence</h1>
          </div>
          <p className="text-slate-400 text-sm">AI-powered insights and automation for your sales team.</p>
        </div>
        {credits !== null && (
          <div className="bg-[#F47920]/10 border border-[#F47920]/20 rounded-xl px-4 py-2 text-right">
            <p className="text-[#F47920] font-bold text-lg">{credits}</p>
            <p className="text-slate-500 text-xs">AI credits</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); resetResult() }}
            className={clsx('flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition',
              activeTab === tab.key
                ? 'bg-[#F47920]/15 text-[#F47920] border border-[#F47920]/30'
                : 'bg-[#0D1B2E] text-slate-400 hover:text-white border border-white/5 hover:border-white/10')}>
            {tab.icon} {tab.label}
            <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full font-semibold">{tab.cost}cr</span>
          </button>
        ))}
      </div>

      {/* Tab description */}
      <p className="text-slate-500 text-sm mb-5">{tabs.find(t => t.key === activeTab)?.desc}</p>

      {/* Summarize panel */}
      {activeTab === 'summarize' && (
        <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 space-y-4">
          <div>
            <label className={labelCls}>Record Type</label>
            <div className="flex gap-2">
              {(['deal','contact','account'] as const).map(t => (
                <button key={t} onClick={() => { setSumType(t); setSumId('') }}
                  className={clsx('flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition',
                    sumType === t ? 'bg-[#F47920]/20 text-[#F47920] border border-[#F47920]/30' : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-transparent')}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Select {sumType.charAt(0).toUpperCase() + sumType.slice(1)}</label>
            <Select value={sumId} onValueChange={v => setSumId(v)} placeholder="Choose…" allowClear clearLabel="Choose…"
              options={
                sumType === 'deal'    ? deals.map(d => ({ value: d.id, label: d.title })) :
                sumType === 'contact' ? contacts.map(c => ({ value: c.id, label: `${c.first_name} ${c.last_name ?? ''}`.trim() })) :
                                        accounts.map(a => ({ value: a.id, label: a.name }))
              } />
          </div>
          <button onClick={runSummarize} disabled={loading || !sumId}
            className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition w-full justify-center">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Analyzing…' : 'Generate Summary (1 credit)'}
          </button>
        </div>
      )}

      {/* Email Drafter panel */}
      {activeTab === 'draft-email' && (
        <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 space-y-4">
          <div>
            <label className={labelCls}>Email Purpose *</label>
            <input className={inputCls} placeholder="e.g. Follow up after demo call, Proposal follow-up, Re-engagement…"
              value={emailPurpose} onChange={e => setEmailPurpose(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Tone</label>
              <Select value={emailTone} onValueChange={v => setEmailTone(v)}
              options={['professional','friendly','urgent','formal','consultative'].map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))} />
            </div>
            <div>
              <label className={labelCls}>Contact (optional)</label>
              <Select value={emailContactId} onValueChange={v => setEmailContactId(v)} placeholder="No contact" allowClear clearLabel="No contact"
              options={contacts.map(c => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }))} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Deal Context (optional)</label>
            <Select value={emailDealId} onValueChange={v => setEmailDealId(v)} placeholder="No deal" allowClear clearLabel="No deal"
              options={deals.map(d => ({ value: d.id, label: d.title }))} />
          </div>
          <div>
            <label className={labelCls}>Additional Context</label>
            <textarea rows={2} className={inputCls} placeholder="Any specific points you want included…"
              value={emailContext} onChange={e => setEmailContext(e.target.value)} />
          </div>
          <button onClick={runDraftEmail} disabled={loading || !emailPurpose.trim()}
            className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition w-full justify-center">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {loading ? 'Drafting…' : 'Draft Email (1 credit)'}
          </button>
        </div>
      )}

      {/* Insights panel */}
      {activeTab === 'insights' && (
        <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 space-y-4">
          <div className="bg-white/3 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Imperial Intelligence will analyze your last <span className="text-white font-semibold">30 days</span> of CRM data including deals, leads, invoices, and tickets — then provide strategic recommendations tailored for your sales team.</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[['Deals', 'Win/loss analysis'],['Leads', 'Conversion funnel'],['Revenue', 'Invoice trends']].map(([t, d]) => (
              <div key={t} className="bg-white/3 rounded-lg p-3">
                <p className="text-white text-sm font-semibold">{t}</p>
                <p className="text-slate-600 text-xs">{d}</p>
              </div>
            ))}
          </div>
          <button onClick={runInsights} disabled={loading}
            className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition w-full justify-center">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
            {loading ? 'Analyzing 30 days of data…' : 'Generate Sales Insights (2 credits)'}
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-5">
          <ResultBox text={result.text} provider={result.provider} />
        </div>
      )}
    </div>
  )
}
