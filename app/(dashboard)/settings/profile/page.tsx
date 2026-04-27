'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { User, Save, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

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

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  if (loading) return <div className="p-8"><div className="h-48 bg-white/3 rounded-xl animate-pulse" /></div>

  return (
    <div className="p-8 max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <User className="w-5 h-5 text-[#F47920]" />
        <div>
          <h1 className="text-white font-bold text-xl">My Profile</h1>
          <p className="text-slate-500 text-sm">Update your personal display name and avatar.</p>
        </div>
      </div>

      <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 space-y-4">
        {/* Avatar preview */}
        <div className="flex items-center gap-4 mb-2">
          <div className="w-14 h-14 rounded-full bg-[#F47920]/20 flex items-center justify-center text-[#F47920] text-xl font-black">
            {form.full_name.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-white font-semibold">{form.full_name || 'Your Name'}</p>
            <p className="text-slate-500 text-xs">{session?.user?.email}</p>
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

        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>
    </div>
  )
}
