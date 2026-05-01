'use client'
import { use } from 'react'
import { ExternalLink } from 'lucide-react'
import DetailShell, { inputCls, labelCls } from '@/components/DetailShell'

import Select from '@/components/ui/Select'
type Doc = {
  id: string; name: string; file_url: string; file_type: string; file_size: number
  category: string; account_id: string | null; contact_id: string | null; deal_id: string | null
  created_at: string
  crm_users: { full_name: string } | null
  crm_accounts: { name: string } | null
}

const CATEGORY_OPTIONS = ['contract', 'proposal', 'invoice', 'report', 'legal', 'general', 'other']

const fmtSize = (b: number) => {
  if (!b) return '—'
  if (b > 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  if (b > 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${b} B`
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <DetailShell<Doc>
      id={id} apiPath="/api/documents" backHref="/documents" entityLabel="document"
      title={r => r.name}
      subtitle={r => <>{r.file_type ?? 'file'} · {fmtSize(r.file_size)}{r.crm_accounts?.name && ` · ${r.crm_accounts.name}`}</>}
      validate={f => !f.name?.trim() ? 'Name is required.' : null}
      buildPayload={f => ({ name: f.name, category: f.category })}
    >
      {(record, form, update) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><label className={labelCls}>Name *</label>
            <input className={inputCls} value={form.name ?? ''} onChange={e => update('name', e.target.value)} /></div>
          <div><label className={labelCls}>Category</label>
            <Select value={form.category ?? ''} onValueChange={v => update('category', v)}
              options={CATEGORY_OPTIONS.map(c => ({ value: c, label: c }))} /></div>
          <div><label className={labelCls}>File Type</label>
            <input className={inputCls} value={record.file_type ?? ''} disabled /></div>
          <div className="sm:col-span-2">
            <a href={record.file_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 bg-[#F47920]/10 hover:bg-[#F47920]/20 text-[#F47920] font-semibold px-4 py-2.5 rounded-lg text-sm transition w-fit">
              <ExternalLink className="w-4 h-4" /> Open file
            </a>
          </div>
        </div>
      )}
    </DetailShell>
  )
}
