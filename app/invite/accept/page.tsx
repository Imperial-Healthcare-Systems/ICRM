'use client'

/**
 * Public invite-acceptance page — Phase 3 §6.2.
 *
 * Reads `?token=...` from the URL, kicks off /api/team/accept to send
 * an OTP to the invitee's email, then verifies via /accept/complete
 * which provisions identity + membership + crm_users.
 *
 * UI matches the ICRM signup/login pattern (dark gradient card, orange
 * CTA, Inter font). Watermark at the bottom is mandatory (§9.2 auth surface).
 */
import { Suspense, useEffect, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck, AlertCircle } from 'lucide-react'
import PoweredByImperial from '@/components/branding/PoweredByImperial'

type Stage = 'requesting' | 'awaiting-otp' | 'submitting' | 'success' | 'error'

function AcceptInner() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''

  const [stage, setStage] = useState<Stage>('requesting')
  const [error, setError] = useState('')
  const [challengeToken, setChallengeToken] = useState('')
  const [maskedEmail, setMaskedEmail] = useState('')
  const [orgName, setOrgName] = useState('')
  const [role, setRole] = useState('')
  const [identityExists, setIdentityExists] = useState(true)
  const [otp, setOtp] = useState('')
  const [fullName, setFullName] = useState('')
  const [devOtp, setDevOtp] = useState('')

  useEffect(() => {
    let cancelled = false
    async function kickoff() {
      if (!token) {
        setStage('error')
        setError('No invitation token in the link. Re-check the URL from your email.')
        return
      }
      try {
        const res = await fetch('/api/team/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setStage('error')
          setError(data.error ?? 'Invitation could not be loaded.')
          return
        }
        setChallengeToken(data.challengeToken)
        setMaskedEmail(data.email ? maskEmail(data.email) : '')
        setOrgName(data.orgName ?? 'your new organisation')
        setRole(data.role ?? 'member')
        if (data.devOtp) setDevOtp(data.devOtp)
        setStage('awaiting-otp')
      } catch (e) {
        if (cancelled) return
        setStage('error')
        setError(e instanceof Error ? e.message : 'Network error')
      }
    }
    kickoff()
    return () => {
      cancelled = true
    }
  }, [token])

  async function submitOtp(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code from your email.')
      return
    }
    setStage('submitting')
    try {
      const res = await fetch('/api/team/accept/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          otp,
          challengeToken,
          full_name: fullName.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Distinguish "needs full_name" from other errors so we can prompt for it.
        if (res.status === 400 && /full_name/.test(data.error ?? '')) {
          setIdentityExists(false)
          setStage('awaiting-otp')
          setError('You\'re new here — please tell us your name to finish setting up.')
          return
        }
        setStage('awaiting-otp')
        setError(data.error ?? 'Acceptance failed.')
        return
      }
      setStage('success')
      setTimeout(() => router.push(data.redirectTo ?? '/login'), 1500)
    } catch (e) {
      setStage('awaiting-otp')
      setError(e instanceof Error ? e.message : 'Network error')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#07111F] via-[#0a1a2e] to-[#07111F] text-slate-100">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="bg-[#0f1f33] border border-slate-700/60 rounded-2xl shadow-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#F47920]/15 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-[#F47920]" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Join {orgName || 'an organisation'}</h1>
                <p className="text-xs text-slate-400 mt-0.5">Invitation accepted on Imperial CRM</p>
              </div>
            </div>

            {stage === 'requesting' && (
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading invitation…
              </div>
            )}

            {stage === 'error' && (
              <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Can&apos;t open this invitation</p>
                  <p className="text-red-300/80 text-xs mt-1">{error}</p>
                  <Link href="/login" className="text-xs text-[#F47920] mt-3 inline-flex items-center gap-1 hover:underline">
                    Go to login <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )}

            {(stage === 'awaiting-otp' || stage === 'submitting') && (
              <form onSubmit={submitOtp} className="space-y-4">
                <p className="text-sm text-slate-300">
                  We sent a 6-digit verification code to <strong className="text-white">{maskedEmail || 'your email'}</strong>.
                  Enter it below to join <strong className="text-white">{orgName}</strong> as <strong className="text-white">{role.replace(/_/g, ' ')}</strong>.
                </p>

                {devOtp && (
                  <p className="text-xs bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-md px-2 py-1.5">
                    DEV mode: <code className="font-mono">{devOtp}</code>
                  </p>
                )}

                <input
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="w-full bg-[#07111F] border border-slate-600 rounded-lg px-3 py-2.5 text-center tracking-[0.5em] text-lg font-mono outline-none focus:border-[#F47920]"
                />

                {!identityExists && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Your full name</label>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Asha Sharma"
                      className="w-full bg-[#07111F] border border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#F47920]"
                    />
                  </div>
                )}

                {error && (
                  <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={stage === 'submitting' || otp.length !== 6}
                  className="w-full bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition flex items-center justify-center gap-2"
                >
                  {stage === 'submitting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {stage === 'submitting' ? 'Joining…' : 'Accept and join'}
                </button>
              </form>
            )}

            {stage === 'success' && (
              <div className="flex items-start gap-2 text-sm text-emerald-200 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="font-medium">You&apos;re in.</p>
                  <p className="text-xs mt-1">Redirecting to sign-in…</p>
                </div>
              </div>
            )}
          </div>

          <PoweredByImperial forceShow context="auth" />

          <p className="text-center text-slate-600 text-xs mt-2">
            © {new Date().getFullYear()} Imperial Tech Innovations Pvt Ltd · GSTIN: 06AAICI5025Q1Z6
          </p>
        </div>
      </div>
    </div>
  )
}

function maskEmail(email: string) {
  const [local, domain = ''] = email.split('@')
  if (!local) return email
  const visible = local.slice(0, 2)
  const masked = '*'.repeat(Math.max(local.length - 2, 2))
  return `${visible}${masked}@${domain}`
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07111F]" />}>
      <AcceptInner />
    </Suspense>
  )
}
