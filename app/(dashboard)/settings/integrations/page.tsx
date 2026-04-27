'use client'

import { useSession } from 'next-auth/react'
import { Puzzle, CheckCircle, XCircle, Copy, Check, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1.5 text-xs font-semibold ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
      {ok ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {label}
    </span>
  )
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-slate-300 text-xs font-mono truncate">
          {value}
        </code>
        <button
          onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          className="text-slate-500 hover:text-slate-300 transition p-1"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

export default function IntegrationsSettings() {
  const { data: session } = useSession()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://imperialcrm.cloud'

  const integrations = [
    {
      name: 'Cashfree Payments',
      desc: 'Credit top-up via UPI, cards, and net banking.',
      configured: !!process.env.NEXT_PUBLIC_CASHFREE_MODE,
      docsUrl: 'https://docs.cashfree.com/',
    },
    {
      name: 'SMTP Email (Nodemailer)',
      desc: 'OTP, welcome, invoice, and sequence emails.',
      configured: true,
      docsUrl: null,
    },
    {
      name: 'Supabase Storage',
      desc: 'Document uploads (crm-documents bucket).',
      configured: true,
      docsUrl: null,
    },
    {
      name: 'Imperial Ecosystem',
      desc: 'Shared event bus with IHRMS and other modules.',
      configured: true,
      docsUrl: null,
    },
  ]

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Puzzle className="w-5 h-5 text-[#F47920]" />
        <div>
          <h1 className="text-white font-bold text-xl">Integrations</h1>
          <p className="text-slate-500 text-sm">API endpoints and connected services.</p>
        </div>
      </div>

      {/* API reference */}
      <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 space-y-4">
        <h3 className="text-white font-semibold text-sm">API Reference</h3>
        <CopyField label="Organisation ID (use as API reference)" value={session?.user?.orgId ?? '—'} />
        <CopyField label="Cashfree Webhook URL" value={`${appUrl}/api/webhooks/cashfree`} />
        <CopyField label="Ecosystem Cron Endpoint" value={`${appUrl}/api/cron/ecosystem/process`} />
      </div>

      {/* Connected services */}
      <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 space-y-4">
        <h3 className="text-white font-semibold text-sm">Connected Services</h3>
        <div className="space-y-3">
          {integrations.map(intg => (
            <div key={intg.name} className="flex items-start justify-between py-3 border-b border-white/5 last:border-0">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-white text-sm font-medium">{intg.name}</p>
                  {intg.docsUrl && (
                    <a href={intg.docsUrl} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-slate-300 transition">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <p className="text-slate-500 text-xs">{intg.desc}</p>
              </div>
              <StatusBadge ok={intg.configured} label={intg.configured ? 'Connected' : 'Not configured'} />
            </div>
          ))}
        </div>
      </div>

      {/* Env vars reference */}
      <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6">
        <h3 className="text-white font-semibold text-sm mb-3">Required Environment Variables</h3>
        <div className="space-y-1">
          {[
            ['CASHFREE_APP_ID', 'Cashfree App ID'],
            ['CASHFREE_SECRET_KEY', 'Cashfree Secret Key'],
            ['CASHFREE_ENV', 'SANDBOX or PRODUCTION'],
            ['SMTP_HOST / SMTP_USER / SMTP_PASS', 'Email delivery'],
            ['CRON_SECRET', 'Secures cron endpoints on Vercel'],
            ['NEXT_PUBLIC_APP_URL', 'Base URL of your deployment'],
          ].map(([key, desc]) => (
            <div key={key} className="flex items-start gap-3 py-1.5">
              <code className="text-[#F47920] text-xs font-mono shrink-0 w-64">{key}</code>
              <span className="text-slate-500 text-xs">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
