'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Mail, ShieldCheck, ArrowLeft, Eye, EyeOff } from 'lucide-react'

type Step = 'email' | 'otp'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard'
  const denied = searchParams.get('denied') === '1'

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [challengeToken, setChallengeToken] = useState('')
  const [maskedEmail, setMaskedEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showOtp, setShowOtp] = useState(false)

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to send OTP. Try again.')
        return
      }

      setChallengeToken(data.challengeToken ?? '')
      setMaskedEmail(data.masked ?? email)
      setStep('otp')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email: email.trim().toLowerCase(),
        otp,
        challengeToken,
      })

      if (result?.error) {
        setError(result.error === 'CredentialsSignin' ? 'Incorrect OTP. Please try again.' : result.error)
        return
      }

      router.push(callbackUrl)
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function resendOtp() {
    setOtp('')
    setError('')
    setStep('email')
  }

  return (
    <div className="min-h-screen bg-[#07111F] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src="/iti_logo.png" alt="Imperial CRM" width={58} height={58} className="rounded-xl shrink-0 -mt-1" />
          <div>
            <p className="text-white font-bold text-lg leading-none">Imperial CRM<sup className="text-[10px] font-semibold text-slate-400 ml-0.5 align-super">™</sup></p>
            <p className="text-slate-400 text-xs mt-1">Imperial Tech Innovations</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#0D1B2E] border border-white/10 rounded-2xl p-8 shadow-2xl">
          {denied && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
              You don&apos;t have permission to access that page.
            </div>
          )}

          {step === 'email' ? (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-lg bg-[#F47920]/20 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-[#F47920]" />
                </div>
                <div>
                  <h1 className="text-white font-bold text-lg leading-none">Sign in</h1>
                  <p className="text-slate-400 text-xs mt-0.5">Enter your work email to continue</p>
                </div>
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Work Email
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 focus:ring-1 focus:ring-[#F47920]/30 transition"
                  />
                </div>

                {error && (
                  <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loading ? 'Sending code...' : 'Send sign-in code'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-lg bg-[#F47920]/20 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-[#F47920]" />
                </div>
                <div>
                  <h1 className="text-white font-bold text-lg leading-none">Enter your code</h1>
                  <p className="text-slate-400 text-xs mt-0.5">Sent to {maskedEmail}</p>
                </div>
              </div>

              <form onSubmit={handleOtpSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    6-digit OTP
                  </label>
                  <div className="relative">
                    <input
                      type={showOtp ? 'text' : 'password'}
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      required
                      autoFocus
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="••••••"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 pr-10 text-white placeholder-slate-500 text-sm tracking-widest focus:outline-none focus:border-[#F47920]/60 focus:ring-1 focus:ring-[#F47920]/30 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOtp(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                    >
                      {showOtp ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>

                <button
                  type="button"
                  onClick={resendOtp}
                  className="w-full flex items-center justify-center gap-1.5 text-slate-400 hover:text-slate-200 text-xs transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Use a different email or resend code
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          © {new Date().getFullYear()} Imperial Tech Innovations Pvt Ltd · GSTIN: 06AAICI5025Q1Z6
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07111F]" />}>
      <LoginForm />
    </Suspense>
  )
}
