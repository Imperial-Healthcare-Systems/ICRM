'use client'

import { MessageSquare } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import Link from 'next/link'

export default function WhatsAppPage() {
  return (
    <div className="p-6">
      <PageHeader title="WhatsApp" subtitle="Business messaging" />
      <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-12 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mb-4">
          <MessageSquare className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-white font-semibold text-lg mb-2">WhatsApp Business API</h2>
        <p className="text-slate-400 text-sm max-w-sm mb-6">
          Send bulk WhatsApp messages and campaigns to your contacts via the Meta Business API.
          WhatsApp campaigns can be created from the Campaigns section.
        </p>
        <div className="flex gap-3">
          <Link href="/campaigns/new" className="bg-[#F47920] hover:bg-[#e06810] text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition">
            Create WhatsApp Campaign
          </Link>
          <a
            href="https://business.facebook.com/wa/manage"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition"
          >
            Meta Business Manager ↗
          </a>
        </div>
      </div>
    </div>
  )
}
