'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { BookOpen, Plus, Search, Eye, Globe, Lock } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import StatusPill, { pillToneForStatus } from '@/components/ui/StatusPill'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import Select from '@/components/ui/Select'

type Article = {
  id: string; slug: string; title: string; excerpt: string | null
  category: string; status: string; is_public: boolean
  view_count: number; published_at: string | null; updated_at: string
  crm_users: { full_name: string } | null
}

export default function KbPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const fetchArticles = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      const res = await fetch(`/api/kb?${params}`)
      const data = await res.json()
      setArticles(data.data ?? [])
    } finally { setLoading(false) }
  }, [search, status])

  useEffect(() => { fetchArticles() }, [fetchArticles])

  return (
    <div className="p-6 mx-auto max-w-7xl">
      <PageHeader
        kicker="Resources"
        title="Knowledge Base"
        subtitle={`${articles.length} articles`}
        actions={<Button href="/knowledge-base/new" icon={<Plus className="w-4 h-4" />}>New Article</Button>}
      />

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" placeholder="Search articles…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#0D1B2E] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#F47920]/60 transition" />
        </div>
        <div className="w-44">
          <Select value={status} onValueChange={setStatus} placeholder="All statuses" allowClear clearLabel="All statuses"
            options={['draft', 'published', 'archived'].map(s => ({ value: s, label: s }))} />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map(i => <Skeleton key={i} variant="card" />)}
        </div>
      ) : articles.length === 0 ? (
        <div className="surface-premium">
          <EmptyState icon={<BookOpen className="w-7 h-7" />} title="No articles yet"
            description="Write articles to help customers self-serve and reduce support load."
            actionLabel="New Article" actionHref="/knowledge-base/new" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {articles.map((a, idx) => (
            <Link key={a.id} href={`/knowledge-base/${a.id}`}
              className="surface-premium hover-lift p-4 transition group anim-rise hover:border-[#F47920]/30"
              style={{ animationDelay: `${Math.min(idx * 30, 200)}ms` }}>
              <div className="flex items-center justify-between mb-2">
                <StatusPill tone={pillToneForStatus(a.status)} size="sm" uppercase={false} className="capitalize">{a.status}</StatusPill>
                {a.is_public ? <Globe className="w-3 h-3 text-emerald-400" /> : <Lock className="w-3 h-3 text-slate-500" />}
              </div>
              <h3 className="text-white font-semibold text-sm group-hover:text-[#F47920] transition leading-snug">{a.title}</h3>
              {a.excerpt && <p className="text-slate-500 text-xs mt-1.5 line-clamp-2">{a.excerpt}</p>}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04] text-[10px] text-slate-500">
                <span className="capitalize">{a.category}</span>
                <span className="flex items-center gap-1 tabular-nums"><Eye className="w-3 h-3" /> {a.view_count}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
