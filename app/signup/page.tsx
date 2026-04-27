'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Building2, ShieldCheck, Eye, EyeOff } from 'lucide-react'

type Step = 'details' | 'otp'

const PLAN_OPTIONS = [
  { value: 'starter',    label: 'Starter',    price: 'Free 14-day trial' },
  { value: 'growth',     label: 'Growth',     price: 'Free 14-day trial' },
  { value: 'pro',        label: 'Pro',        price: 'Free 14-day trial' },
  { value: 'enterprise', label: 'Enterprise', price: 'Free 14-day trial' },
]

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('details')
  const [form, setForm] = useState({
    org_name: '',
    full_name: '',
    email: '',
    phone: '',
    gstin: '',
    plan_tier: 'starter',
  })
  const [otp, setOtp] = useState('')
  const [challengeToken, setChallengeToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showOtp, setShowOtp] = useState(false)

  function updateField(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Signup failed. Try again.')
        return
      }

      setChallengeToken(data.challengeToken ?? '')
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
        email: form.email.trim().toLowerCase(),
        otp,
        challengeToken,
      })

      if (result?.error) {
        setError(result.error === 'CredentialsSignin' ? 'Incorrect OTP. Please try again.' : result.error)
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#07111F] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#F47920] flex items-center justify-center font-black text-white text-base">
            IC
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none">Imperial CRM</p>
            <p className="text-slate-400 text-xs">Imperial Tech Innovations</p>
          </div>
        </div>

        <div className="bg-[#0D1B2E] border border-white/10 rounded-2xl p-8 shadow-2xl">
          {step === 'details' ? (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-lg bg-[#F47920]/20 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-[#F47920]" />
                </div>
                <div>
                  <h1 className="text-white font-bold text-lg leading-none">Create your workspace</h1>
                  <p className="text-slate-400 text-xs mt-0.5">14-day free trial · No credit card required</p>
                </div>
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Organisation Name *</label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={form.org_name}
                      onChange={e => updateField('org_name', e.target.value)}
                      placeholder="Acme Corp"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 focus:ring-1 focus:ring-[#F47920]/30 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Your Name *</label>
                    <input
                      type="text"
                      required
                      value={form.full_name}
                      onChange={e => updateField('full_name', e.target.value)}
                      placeholder="John Doe"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 focus:ring-1 focus:ring-[#F47920]/30 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Work Email *</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={e => updateField('email', e.target.value)}
                      placeholder="you@company.com"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 focus:ring-1 focus:ring-[#F47920]/30 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => updateField('phone', e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 focus:ring-1 focus:ring-[#F47920]/30 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">GSTIN</label>
                    <input
                      type="text"
                      value={form.gstin}
                      onChange={e => updateField('gstin', e.target.value)}
                      placeholder="22AAAAA0000A1Z5"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 focus:ring-1 focus:ring-[#F47920]/30 transition"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Plan</label>
                    <div className="grid grid-cols-4 gap-2">
                      {PLAN_OPTIONS.map(p => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => updateField('plan_tier', p.value)}
                          className={`rounded-lg border px-3 py-2 text-xs font-semibold transition text-center ${
                            form.plan_tier === p.value
                              ? 'border-[#F47920] bg-[#F47920]/10 text-[#F47920]'
                              : 'border-white/10 text-slate-400 hover:border-white/20'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
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
                  {loading ? 'Creating workspace...' : 'Start free trial'}
                </button>

                <p className="text-center text-slate-500 text-xs">
                  Already have an account?{' '}
                  <Link href="/login" className="text-[#F47920] hover:underline">Sign in</Link>
                </p>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-lg bg-[#F47920]/20 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-[#F47920]" />
                </div>
                <div>
                  <h1 className="text-white font-bold text-lg leading-none">Verify your email</h1>
                  <p className="text-slate-400 text-xs mt-0.5">
                    We sent a 6-digit code to {form.email}
                  </p>
                </div>
              </div>

              <form onSubmit={handleOtpSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">6-digit OTP</label>
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
                  {loading ? 'Activating workspace...' : 'Activate workspace'}
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
