'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { User, Save, Loader2, Palette } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '@/components/PageHeader'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import Skeleton from '@/components/ui/Skeleton'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { inputCls, labelCls } from '@/components/DetailShell'

export default function ProfileSettings() {
  const { data: session } = useSession()
  const [form, setForm] = useState({ full_name: '', avatar_url: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/team').then(r => r.json()).then(d => {
      const me = (d.data ?? []).find((u: { id: string }) => u.id === session?.user?.id)
      if (me) setForm({ full_name: me.full_name ?? '', avatar_url: me.avatar_url ?? '' })
      setLoading(false)
    })
  }, [session?.user?.id])

  async function save() {
    if (!form.full_name.trim()) { toast.error('Name is required.'); return }
    setSaving(true)
    const res = await fetch(`/api/settings/team/${session?.user?.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: form.full_name, avatar_url: form.avatar_url }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Failed to save.'); setSaving(false); return }
    toast.success('Profile updated.')
    setSaving(false)
  }

  return (
    <div className="p-8 mx-auto max-w-2xl space-y-6">
      <PageHeader
        kicker="Settings"
        title="My Profile"
        subtitle="Update your personal display name, avatar, and appearance preferences"
      />

      {/* Profile section */}
      <section className="surface-premium p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <User className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="text-headline text-[var(--text-primary)]">Profile</h2>
        </div>

        {loading ? (
          <Skeleton className="h-48 rounded-xl" />
        ) : (
          <>
            <div className="flex items-center gap-4 mb-2">
              {form.avatar_url ? (
                <Avatar src={form.avatar_url} name={form.full_name} size="lg" />
              ) : (
                <Avatar name={form.full_name || '?'} brand size="lg" />
              )}
              <div>
                <p className="text-[var(--text-primary)] font-semibold">{form.full_name || 'Your Name'}</p>
                <p className="text-[var(--text-muted)] text-xs">{session?.user?.email}</p>
              </div>
            </div>

            <div>
              <label className={labelCls}>Full Name *</label>
              <input className={inputCls} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="John Doe" />
            </div>
            <div>
              <label className={labelCls}>Avatar URL</label>
              <input className={inputCls} value={form.avatar_url} onChange={e => setForm(f => ({ ...f, avatar_url: e.target.value }))} placeholder="https://cdn.example.com/avatar.jpg" />
            </div>
            <div>
              <label className={labelCls}>Email (read-only)</label>
              <input className={inputCls} value={session?.user?.email ?? ''} disabled />
            </div>

            <Button
              onClick={save}
              loading={saving}
              icon={!saving ? <Save className="w-4 h-4" /> : undefined}
            >
              {saving ? 'Saving…' : 'Save Profile'}
            </Button>
          </>
        )}
      </section>

      {/* Appearance section */}
      <section className="surface-premium p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Palette className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="text-headline text-[var(--text-primary)]">Appearance</h2>
        </div>
        <p className="text-[var(--text-muted)] text-xs -mt-1">
          Choose how Imperial CRM looks. The sidebar stays dark in all modes — it&apos;s the brand anchor.
        </p>
        <ThemeToggle />
      </section>
    </div>
  )
}
