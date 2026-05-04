'use client'

import { MessageSquare, ExternalLink } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import Button from '@/components/ui/Button'

export default function WhatsAppPage() {
  return (
    <div className="p-6 mx-auto max-w-3xl">
      <PageHeader kicker="Marketing" title="WhatsApp" subtitle="Business messaging" />
      <div className="surface-premium p-12 flex flex-col items-center text-center relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5 mx-auto">
            <MessageSquare className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-white text-title-3 mb-2">WhatsApp Business API</h2>
          <p className="text-slate-400 text-sm max-w-md mb-6 leading-relaxed">
            Send bulk WhatsApp messages and campaigns to your contacts via the Meta Business API.
            WhatsApp campaigns can be created from the Campaigns section.
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            <Button href="/campaigns/new">Create WhatsApp Campaign</Button>
            <a
              href="https://business.facebook.com/wa/manage"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-white/[0.06] hover:bg-white/10 text-white font-semibold text-sm h-9 px-4 rounded-lg transition border border-white/10"
            >
              Meta Business Manager <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
