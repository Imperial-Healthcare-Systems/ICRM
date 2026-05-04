'use client'
import { use, useState } from 'react'
import DetailShell, { inputCls, labelCls } from '@/components/DetailShell'
import Select from '@/components/ui/Select'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { Eye, Globe, Lock, ExternalLink, Copy, Check } from 'lucide-react'

type Article = {
  id: string; slug: string; title: string; content: string; excerpt: string | null
  category: string; tags: string[]; status: string; is_public: boolean
  view_count: number; helpful_count: number; unhelpful_count: number
  published_at: string | null; org_id: string
  crm_users: { full_name: string } | null
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [copied, setCopied] = useState(false)

  return (
    <DetailShell<Article>
      id={id} apiPath="/api/kb" backHref="/knowledge-base" entityLabel="article"
      title={r => r.title}
      subtitle={r => <>/{r.slug} · <Eye className="w-3 h-3 inline" /> {r.view_count} views · 👍 {r.helpful_count} 👎 {r.unhelpful_count}</>}
      badges={r => (
        <>
          <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase',
            r.status === 'published' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'
          )}>{r.status}</span>
          {r.is_public ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 flex items-center gap-1"><Globe className="w-3 h-3" /> PUBLIC</span> : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-400 flex items-center gap-1"><Lock className="w-3 h-3" /> PRIVATE</span>}
        </>
      )}
      validate={f => !f.title?.trim() ? 'Title required.' : !f.content?.trim() ? 'Content required.' : null}
      buildPayload={f => ({
        title: f.title, content: f.content, excerpt: f.excerpt,
        category: f.category, tags: f.tags, status: f.status, is_public: f.is_public,
      })}
    >
      {(record, form, update) => {
        const publicUrl = typeof window !== 'undefined' && record.is_public && record.status === 'published'
          ? `${window.location.origin}/kb/${record.org_id}/${record.slug}` : null

        function copyUrl() {
          if (!publicUrl) return
          navigator.clipboard.writeText(publicUrl)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
          toast.success('Link copied.')
        }

        return (
          <div className="space-y-4">
            {publicUrl && (
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                <input readOnly value={publicUrl} onClick={e => e.currentTarget.select()}
                  className="flex-1 bg-transparent text-emerald-300 text-xs outline-none truncate" />
                <button type="button" onClick={copyUrl} className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 px-2 py-1 rounded text-xs flex items-center gap-1">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <a href={publicUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300"><ExternalLink className="w-3 h-3" /></a>
              </div>
            )}

            <div><label className={labelCls}>Title *</label>
              <input className={inputCls} value={form.title ?? ''} onChange={e => update('title', e.target.value)} /></div>

            <div><label className={labelCls}>Excerpt</label>
              <input className={inputCls} value={form.excerpt ?? ''} onChange={e => update('excerpt', e.target.value)} placeholder="Short summary" /></div>

            <div><label className={labelCls}>Content (Markdown) *</label>
              <textarea rows={16} className={clsx(inputCls, 'font-mono text-xs leading-relaxed resize-y')}
                value={form.content ?? ''} onChange={e => update('content', e.target.value)} /></div>

            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelCls}>Category</label>
                <input className={inputCls} value={form.category ?? ''} onChange={e => update('category', e.target.value)} /></div>
              <div><label className={labelCls}>Status</label>
                <Select value={form.status ?? ''} onValueChange={v => update('status', v)}
                  options={['draft', 'published', 'archived'].map(s => ({ value: s, label: s }))} /></div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_public ?? true} onChange={e => update('is_public', e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#F47920]" />
                  <span className="text-white text-xs">Public</span>
                </label>
              </div>
            </div>
          </div>
        )
      }}
    </DetailShell>
  )
}
