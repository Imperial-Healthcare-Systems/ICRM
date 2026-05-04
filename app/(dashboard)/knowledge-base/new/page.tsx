'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import Select from '@/components/ui/Select'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

export default function NewKbPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '', slug: '', excerpt: '', content: '',
    category: 'general', tags: '',
    status: 'draft', is_public: true,
  })

  function update(field: string, value: string | boolean) { setForm(f => ({ ...f, [field]: value })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) { toast.error('Title and content are required.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/kb', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success(form.status === 'published' ? 'Article published!' : 'Draft saved.')
      router.push(`/knowledge-base/${data.data.id}`)
    } finally { setLoading(false) }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader title="New Article" backHref="/knowledge-base" />
      <form onSubmit={submit} className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 space-y-5">
        <div>
          <label className={labelCls}>Title *</label>
          <input required className={inputCls} placeholder="How to reset your password" value={form.title} onChange={e => update('title', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>URL slug (optional)</label>
          <input className={inputCls} placeholder="auto-generated from title" value={form.slug} onChange={e => update('slug', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Excerpt (preview text)</label>
          <input className={inputCls} placeholder="Short one-liner shown in search results" value={form.excerpt} onChange={e => update('excerpt', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Content (Markdown supported) *</label>
          <textarea required rows={14} className={inputCls + ' font-mono text-xs leading-relaxed resize-y'}
            placeholder={'## Heading\n\nWrite your article here using **markdown**.\n\n- bullet list\n- another item'}
            value={form.content} onChange={e => update('content', e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Category</label>
            <input className={inputCls} placeholder="general" value={form.category} onChange={e => update('category', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Tags (comma-separated)</label>
            <input className={inputCls} placeholder="auth, troubleshooting" value={form.tags} onChange={e => update('tags', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <Select value={form.status} onValueChange={v => update('status', v)}
              options={['draft', 'published', 'archived'].map(s => ({ value: s, label: s }))} />
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_public} onChange={e => update('is_public', e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#F47920]" />
          <span className="text-white text-sm">Public — accessible without login</span>
        </label>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Saving…' : 'Save Article'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition">Cancel</button>
        </div>
      </form>
    </div>
  )
}
