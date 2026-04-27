'use client'

import { useEffect, useState, useCallback } from 'react'
import { FolderOpen, Plus, ChevronLeft, ChevronRight, FileText, Trash2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type Doc = {
  id: string; name: string; file_url: string; file_type: string
  file_size: number; category: string; created_at: string
  crm_accounts: { name: string } | null
  crm_contacts: { first_name: string; last_name: string } | null
  crm_users: { full_name: string } | null
}

const CATEGORY_COLORS: Record<string, string> = {
  contract: 'bg-blue-500/20 text-blue-400',
  proposal: 'bg-purple-500/20 text-purple-400',
  invoice:  'bg-emerald-500/20 text-emerald-400',
  report:   'bg-yellow-500/20 text-yellow-400',
  legal:    'bg-red-500/20 text-red-400',
  general:  'bg-slate-500/20 text-slate-400',
  other:    'bg-slate-500/20 text-slate-400',
}

function fmtSize(bytes: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const fetchDocs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (category) params.set('category', category)
      const res = await fetch(`/api/documents?${params}`)
      const data = await res.json()
      setDocs(data.data ?? [])
      setCount(data.count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, category])

  useEffect(() => { setPage(1) }, [category])
  useEffect(() => { fetchDocs() }, [fetchDocs])

  async function deleteDoc(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Document deleted.'); fetchDocs() }
    else toast.error('Failed to delete.')
  }

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="p-6">
      <PageHeader
        title="Documents"
        subtitle={`${count} total`}
        actions={
          <Link href="/documents/new" className="flex items-center gap-1.5 bg-[#F47920] hover:bg-[#e06810] text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
            <Plus className="w-4 h-4" /> Upload Document
          </Link>
        }
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {['', 'contract','proposal','invoice','report','legal','general','other'].map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize',
              category === c ? 'bg-[#F47920]/20 text-[#F47920] border border-[#F47920]/40' : 'bg-white/5 text-slate-400 hover:bg-white/10')}>
            {c === '' ? 'All' : c}
          </button>
        ))}
      </div>

      <div className="bg-[#0D1B2E] border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold">Document</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Category</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Account</th>
              <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Uploaded By</th>
              <th className="text-right px-4 py-3 font-semibold hidden xl:table-cell">Size</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-4 bg-white/5 rounded animate-pulse" /></td></tr>
            )) : docs.length === 0 ? (
              <tr><td colSpan={6}>
                <EmptyState icon={<FolderOpen className="w-7 h-7" />} title="No documents yet" description="Upload and organise documents linked to accounts and deals." actionLabel="Upload Document" actionHref="/documents/new" />
              </td></tr>
            ) : docs.map(d => (
              <tr key={d.id} className="hover:bg-white/3 transition group">
                <td className="px-4 py-3">
                  <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                    <div>
                      <p className="text-white font-medium group-hover:text-[#F47920] transition">{d.name}</p>
                      <p className="text-slate-500 text-xs">{new Date(d.created_at).toLocaleDateString('en-IN')}</p>
                    </div>
                    <ExternalLink className="w-3 h-3 text-slate-600 shrink-0" />
                  </a>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${CATEGORY_COLORS[d.category] ?? ''}`}>{d.category}</span>
                </td>
                <td className="px-4 py-3 text-slate-300 text-xs hidden lg:table-cell">{d.crm_accounts?.name ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden xl:table-cell">{(d.crm_users as { full_name: string } | null)?.full_name ?? '—'}</td>
                <td className="px-4 py-3 text-right text-slate-500 text-xs hidden xl:table-cell">{fmtSize(d.file_size)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => deleteDoc(d.id, d.name)} className="text-slate-600 hover:text-red-400 transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <p className="text-slate-500 text-xs">{count} total · Page {page} of {totalPages}</p>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 flex items-center justify-center text-slate-400 transition"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 flex items-center justify-center text-slate-400 transition"><ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
