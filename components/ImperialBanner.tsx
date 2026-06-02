'use client'

import { useState } from 'react'
import { useSession } from '@/lib/use-session'

export default function ImperialBanner() {
  const { data: session } = useSession()
  const [ending, setEnding] = useState(false)

  const impersonatedBy = session?.user?.impersonatedBy
  if (!impersonatedBy) return null

  async function endSession() {
    setEnding(true)
    try {
      const res = await fetch('/api/auth/impersonation/end', { method: 'POST' })
      const data = await res.json()
      if (data.signOutUrl) {
        window.location.href = data.signOutUrl
      } else {
        window.location.href = '/login'
      }
    } catch {
      setEnding(false)
      alert('Could not end impersonation session. Please sign out manually.')
    }
  }

  return (
    <div className="sticky top-0 z-50 bg-amber-500/95 text-amber-950 border-b border-amber-700 px-4 py-2 flex items-center justify-between gap-4 text-sm shadow-md">
      <div className="flex items-center gap-2 min-w-0">
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.94 6.94a1.5 1.5 0 112.12 2.12L9.06 11.06a1 1 0 11-1.41-1.41l1.29-1.29zM10 14a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
        <span className="truncate">
          <strong>{impersonatedBy.name}</strong> ({impersonatedBy.email}) from Imperial is viewing this account.
          All actions are logged and visible to your team.
        </span>
      </div>
      <button
        onClick={endSession}
        disabled={ending}
        className="shrink-0 bg-amber-950 text-amber-100 hover:bg-amber-900 disabled:opacity-60 px-3 py-1 rounded font-semibold text-xs whitespace-nowrap transition"
      >
        {ending ? 'Ending…' : 'End impersonation'}
      </button>
    </div>
  )
}
