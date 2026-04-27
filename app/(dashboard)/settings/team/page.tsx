'use client'

import { useEffect, useState } from 'react'
import { Users, UserPlus, Loader2, Shield, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type Member = {
  id: string; full_name: string; email: string
  role: string; is_active: boolean; last_login_at: string | null; created_at: string
}

const ROLES = ['super_admin','admin','manager','sales_rep','support_rep','viewer'] as const
const ROLE_COLORS: Record<string, string> = {
  super_admin: 'text-[#F47920] bg-[#F47920]/10',
  admin:       'text-blue-400 bg-blue-400/10',
  manager:     'text-purple-400 bg-purple-400/10',
  sales_rep:   'text-emerald-400 bg-emerald-400/10',
  support_rep: 'text-cyan-400 bg-cyan-400/10',
  viewer:      'text-slate-400 bg-white/5',
}

export default function TeamSettings() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  // Invite form
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('sales_rep')
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    fetch('/api/team?pageSize=100').then(r => r.json()).then(d => {
      setMembers(d.data ?? [])
      setLoading(false)
    })
  }, [])

  async function updateMember(userId: string, updates: Record<string, unknown>) {
    setUpdating(userId)
    const res = await fetch(`/api/settings/team/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error); setUpdating(null); return }
    setMembers(prev => prev.map(m => m.id === userId ? { ...m, ...data.data } : m))
    toast.success('Member updated.')
    setUpdating(null)
  }

  async function sendInvite() {
    if (!inviteEmail.trim() || !inviteName.trim()) { toast.error('Name and email are required.'); return }
    setInviting(true)
    const res = await fetch('/api/auth/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, name: inviteName, role: inviteRole }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Invite failed'); setInviting(false); return }
    toast.success(`Invite sent to ${inviteEmail}`)
    setInviteEmail(''); setInviteName(''); setShowInvite(false)
    setInviting(false)
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 transition'
  const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never'

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-[#F47920]" />
          <div>
            <h1 className="text-white font-bold text-xl">Team</h1>
            <p className="text-slate-500 text-sm">Manage members, roles, and access.</p>
          </div>
        </div>
        <button
          onClick={() => setShowInvite(v => !v)}
          className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] text-white font-semibold px-4 py-2 rounded-lg text-sm transition"
        >
          <UserPlus className="w-4 h-4" />
          Invite Member
        </button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="bg-[#0D1B2E] border border-[#F47920]/20 rounded-xl p-5 space-y-3">
          <p className="text-white font-semibold text-sm">Invite a team member</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input className={inputCls} placeholder="Full name" value={inviteName} onChange={e => setInviteName(e.target.value)} />
            <input className={inputCls} placeholder="Email address" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            <select className={inputCls} value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
              {ROLES.filter(r => r !== 'super_admin').map(r => (
                <option key={r} value={r} className="capitalize">{r.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={sendInvite} disabled={inviting}
              className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg text-sm transition">
              {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              {inviting ? 'Sending…' : 'Send Invite'}
            </button>
            <button onClick={() => setShowInvite(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm transition">Cancel</button>
          </div>
        </div>
      )}

      {/* Members table */}
      <div className="bg-[#0D1B2E] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="h-48 animate-pulse bg-white/3" />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Member</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Last Login</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} className="border-b border-white/5 last:border-0">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#F47920]/20 flex items-center justify-center text-[#F47920] text-xs font-bold shrink-0">
                        {m.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{m.full_name}</p>
                        <p className="text-slate-500 text-xs">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <select
                      value={m.role}
                      disabled={updating === m.id}
                      onChange={e => updateMember(m.id, { role: e.target.value })}
                      className={clsx(
                        'text-xs font-bold px-2.5 py-1 rounded-full border-0 cursor-pointer focus:outline-none capitalize',
                        ROLE_COLORS[m.role] ?? 'text-slate-400 bg-white/5'
                      )}
                    >
                      {ROLES.map(r => <option key={r} value={r} className="bg-[#0D1B2E] text-white capitalize">{r.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className="text-slate-400 text-xs">{fmtDate(m.last_login_at)}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => updateMember(m.id, { is_active: !m.is_active })}
                      disabled={updating === m.id}
                      className={clsx(
                        'flex items-center gap-1.5 text-xs font-semibold transition',
                        m.is_active ? 'text-emerald-400 hover:text-red-400' : 'text-red-400 hover:text-emerald-400'
                      )}
                    >
                      {updating === m.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : m.is_active
                          ? <><CheckCircle className="w-3.5 h-3.5" />Active</>
                          : <><XCircle className="w-3.5 h-3.5" />Inactive</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
