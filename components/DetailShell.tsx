'use client'

import { useEffect, useState, useCallback, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react'

export type DetailShellProps<T> = {
  id: string
  apiPath: string                       // '/api/accounts'
  backHref: string                       // '/accounts'
  entityLabel: string                    // 'account', 'deal'
  title: (record: T) => ReactNode        // accessor fn for the header title
  subtitle?: (record: T) => ReactNode    // optional subline below title
  badges?: (record: T) => ReactNode      // optional pills next to title
  /** Build the form payload from the in-memory record */
  buildPayload?: (form: Partial<T>) => Record<string, unknown>
  /** Required-field validator. Return null if valid, error string otherwise. */
  validate?: (form: Partial<T>) => string | null
  /** Optional: custom delete confirmation copy */
  deleteCopy?: string
  /** Render the form body. Receives the form state and an `update` setter. */
  children: (record: T, form: Partial<T>, update: <K extends keyof T>(k: K, v: T[K]) => void, ctx: { saving: boolean; reload: () => void }) => ReactNode
  /** Optional sidebar (right column) */
  sidebar?: (record: T, form: Partial<T>, update: <K extends keyof T>(k: K, v: T[K]) => void, ctx: { reload: () => void }) => ReactNode
}

export default function DetailShell<T extends { id: string }>({
  id, apiPath, backHref, entityLabel, title, subtitle, badges,
  buildPayload, validate, deleteCopy, children, sidebar,
}: DetailShellProps<T>) {
  const router = useRouter()
  const [record, setRecord] = useState<T | null>(null)
  const [form, setForm] = useState<Partial<T>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${apiPath}/${id}`)
      if (res.status === 404) { setNotFound(true); return }
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? `Failed to load ${entityLabel}.`); return }
      setRecord(data.data)
      setForm(data.data)
    } finally { setLoading(false) }
  }, [id, apiPath, entityLabel])

  useEffect(() => { load() }, [load])

  function update<K extends keyof T>(k: K, v: T[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function save() {
    if (validate) {
      const err = validate(form)
      if (err) { toast.error(err); return }
    }
    setSaving(true)
    try {
      const payload = buildPayload ? buildPayload(form) : form
      const res = await fetch(`${apiPath}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Save failed.'); return }
      toast.success(`${entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)} updated.`)
      load()
    } finally { setSaving(false) }
  }

  async function remove() {
    if (!confirm(deleteCopy ?? `Delete this ${entityLabel}? This cannot be undone.`)) return
    const res = await fetch(`${apiPath}/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success(`${entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)} deleted.`); router.push(backHref) }
    else toast.error('Delete failed.')
  }

  if (loading) return (
    <div className="p-6 max-w-5xl">
      <div className="h-8 w-48 bg-[var(--surface-sunken)] rounded anim-shimmer mb-6" />
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 h-96 bg-[var(--surface-sunken)] rounded-xl anim-shimmer" />
        <div className="h-96 bg-[var(--surface-sunken)] rounded-xl anim-shimmer" />
      </div>
    </div>
  )

  if (notFound || !record) return (
    <div className="p-6 max-w-2xl">
      <div className="bg-[var(--surface)] border border-red-500/20 rounded-xl p-8 text-center shadow-[var(--shadow-sm)]">
        <p className="text-[var(--text-primary)] font-semibold mb-2 capitalize">{entityLabel} not found</p>
        <p className="text-[var(--text-muted)] text-sm mb-4">It may have been deleted or you don&apos;t have access.</p>
        <Link href={backHref} className="text-[var(--accent)] text-sm font-semibold hover:underline">← Back</Link>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <button onClick={() => router.push(backHref)} className="w-9 h-9 rounded-lg bg-[var(--hover-overlay-light)] hover:bg-[var(--hover-overlay-medium)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition shrink-0 mt-0.5">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[var(--text-primary)] font-bold text-xl truncate">{title(record)}</h1>
            {badges?.(record)}
          </div>
          {subtitle && <p className="text-[var(--text-muted)] text-xs mt-0.5">{subtitle(record)}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-xl p-6 shadow-[var(--shadow-sm)]">
            {children(record, form, update, { saving, reload: load })}
            <div className="flex gap-3 mt-5 pt-5 border-t border-[var(--border-subtle)]">
              <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm transition shadow-[var(--accent-shadow)]">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button onClick={remove} className="flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 font-medium px-5 py-2 rounded-lg text-sm transition">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        </div>
        {sidebar && (
          <div className="space-y-4">
            {sidebar(record, form, update, { reload: load })}
          </div>
        )}
      </div>
    </div>
  )
}

// Reusable form classes — token-aware
export const inputCls = 'w-full bg-[var(--surface-sunken)] border border-[var(--border-default)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)] transition disabled:opacity-50'
export const labelCls = 'block text-xs font-medium text-[var(--text-tertiary)] mb-1.5'
