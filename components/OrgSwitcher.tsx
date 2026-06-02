'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from '@/lib/use-session'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type Org = {
  membership_id: string
  membership_role: string
  crm_access: boolean
  hrms_access: boolean
  org_id: string
  org_name: string
  plan_tier: string
  subscription_status: string
  is_active: boolean
}

interface Props {
  /** Fallback name to display when the user has 0 or 1 orgs (no switching UI). */
  orgName: string
}

export default function OrgSwitcher({ orgName }: Props) {
  const { data: session, update } = useSession()
  const [orgs, setOrgs] = useState<Org[] | null>(null)
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!session?.user?.identityId) return
    let cancelled = false
    fetch('/api/auth/orgs')
      .then(r => r.json())
      .then(d => { if (!cancelled) setOrgs(d.data ?? []) })
      .catch(() => { if (!cancelled) setOrgs([]) })
    return () => { cancelled = true }
  }, [session?.user?.identityId])

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  // Fallback while loading, or for single-org users (most common case)
  if (!orgs || orgs.length <= 1) {
    return <p className="text-[var(--sidebar-text-faint)] text-[10px] mt-1.5 truncate">{orgName}</p>
  }

  const activeOrg = orgs.find(o => o.is_active) ?? orgs[0]

  async function switchTo(orgId: string) {
    if (orgId === session?.user?.orgId) { setOpen(false); return }
    setSwitching(orgId)
    try {
      const res = await fetch('/api/auth/switch-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_org_id: orgId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Could not switch organisation.')
        setSwitching(null)
        return
      }
      await update({ activeOrgId: orgId })
      toast.success('Switched organisation. Refreshing…')
      window.location.reload()
    } catch {
      toast.error('Could not switch organisation.')
      setSwitching(null)
    }
  }

  return (
    <div ref={panelRef} className="relative mt-1.5">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-1.5 text-left rounded-md px-1.5 py-1 -mx-1.5 hover:bg-[var(--sidebar-item-hover)] transition group"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`Switch organisation (${orgs.length} available)`}
      >
        <span className="text-[var(--sidebar-text-faint)] text-[10px] truncate group-hover:text-[var(--sidebar-text-muted)]">
          {activeOrg.org_name}
        </span>
        <ChevronsUpDown className="w-3 h-3 text-[var(--sidebar-text-faint)] shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-[var(--sidebar-bg-elevated)] border border-[var(--sidebar-border-strong)] rounded-lg shadow-2xl overflow-hidden anim-scale-in origin-top">
          <p className="px-3 pt-2 pb-1 text-[var(--sidebar-text-faint)] text-[9px] uppercase tracking-[0.12em] font-bold">
            Your organisations
          </p>
          <ul role="listbox" className="pb-1 max-h-72 overflow-y-auto">
            {orgs.map(o => (
              <li key={o.org_id} role="option" aria-selected={o.is_active}>
                <button
                  onClick={() => switchTo(o.org_id)}
                  disabled={switching != null}
                  className={clsx(
                    'w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition disabled:opacity-50',
                    o.is_active
                      ? 'bg-[var(--sidebar-accent-soft)]'
                      : 'hover:bg-[var(--sidebar-item-hover)]',
                  )}
                >
                  <div className="min-w-0">
                    <p className={clsx(
                      'text-xs font-medium truncate',
                      o.is_active ? 'text-[var(--sidebar-accent)]' : 'text-[var(--sidebar-text-secondary)]',
                    )}>
                      {o.org_name}
                    </p>
                    <p className="text-[var(--sidebar-text-faint)] text-[10px] capitalize">
                      {o.plan_tier} · {o.membership_role.replace('_', ' ')}
                    </p>
                  </div>
                  {switching === o.org_id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--sidebar-text-faint)] shrink-0" />
                  ) : o.is_active ? (
                    <Check className="w-3.5 h-3.5 text-[var(--sidebar-accent)] shrink-0" />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
