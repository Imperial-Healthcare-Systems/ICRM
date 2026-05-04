'use client'

import { use, useEffect, useState } from 'react'
import { BookOpen, ThumbsUp, ThumbsDown, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

type Article = {
  id: string; slug: string; title: string; content: string; excerpt: string | null
  category: string; tags: string[]; view_count: number
  helpful_count: number; unhelpful_count: number
  published_at: string | null
  organisation: { name: string; logo_url: string | null } | null
}

export default function PublicArticle({ params }: { params: Promise<{ orgId: string; slug: string }> }) {
  const { orgId, slug } = use(params)
  const [article, setArticle] = useState<Article | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [voted, setVoted] = useState<'helpful' | 'unhelpful' | null>(null)

  useEffect(() => {
    fetch(`/api/public/kb/${slug}?org=${orgId}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setArticle(d.data) })
      .catch(() => setError('Failed to load.'))
  }, [orgId, slug])

  async function vote(v: 'helpful' | 'unhelpful') {
    if (voted) { toast('You already voted.'); return }
    setVoted(v)
    await fetch(`/api/public/kb/${slug}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote: v, org_id: orgId }),
    })
    toast.success('Thanks for the feedback!')
  }

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="bg-white border border-red-200 rounded-2xl p-8 text-center max-w-md">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-slate-900 font-bold text-lg mb-2">Article not found</p>
        <p className="text-slate-500 text-sm">{error}</p>
      </div>
    </div>
  )
  if (!article) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-8 h-8 border-2 border-[#F47920] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Brand strip */}
        <div className="flex items-center gap-2 mb-6">
          <BookOpen className="w-4 h-4 text-[#F47920]" />
          <p className="text-slate-500 text-xs">Help Center · {article.organisation?.name}</p>
        </div>

        <article className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="mb-6">
            <span className="text-[10px] font-bold uppercase text-[#F47920] tracking-wider">{article.category}</span>
            <h1 className="text-slate-900 text-3xl font-bold mt-2 leading-tight">{article.title}</h1>
            {article.excerpt && <p className="text-slate-600 text-base mt-3">{article.excerpt}</p>}
            <p className="text-slate-400 text-xs mt-4">
              Updated {new Date(article.published_at ?? '').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              {' · '}{article.view_count} views
            </p>
          </div>

          {/* Markdown content (simple rendering — preserves whitespace + line breaks) */}
          <div className="prose prose-slate max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-slate-800 text-base leading-relaxed">{article.content}</pre>
          </div>

          {article.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-slate-100">
              {article.tags.map(t => (
                <span key={t} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{t}</span>
              ))}
            </div>
          )}

          {/* Feedback */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-slate-700 text-sm font-semibold mb-3">Was this article helpful?</p>
            <div className="flex gap-2">
              <button onClick={() => vote('helpful')} disabled={!!voted}
                className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
                <ThumbsUp className="w-4 h-4" /> Yes ({article.helpful_count})
              </button>
              <button onClick={() => vote('unhelpful')} disabled={!!voted}
                className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
                <ThumbsDown className="w-4 h-4" /> No ({article.unhelpful_count})
              </button>
            </div>
          </div>
        </article>

        <p className="text-center text-slate-400 text-xs mt-8">Powered by Imperial CRM</p>
      </div>
    </div>
  )
}
