/**
 * POST /api/auth/send-otp
 *
 * New Supabase-Auth-backed OTP send flow.
 *
 *   1. Rate-limit per email and per IP (unchanged from the legacy flow).
 *   2. Look up crm_users by email — gate on is_active + crm_enabled.
 *   3. Mint an OTP via supabaseAdmin.auth.admin.generateLink({ type: 'magiclink' }).
 *      This generates the OTP server-side without sending an email — Supabase
 *      Auth tracks it in auth.flow_state until verifyOtp consumes it.
 *   4. Email the OTP through our existing branded sendOtpEmail template.
 *
 * The response no longer includes a challengeToken — Supabase tracks the
 * pending OTP, so the verify endpoint only needs { email, otp }.
 *
 * Email-enumeration prevention: for non-existent / inactive / not-CRM-enabled
 * accounts we return the same { success: true } shape (with masked email)
 * without sending an email.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendOtpEmail } from '@/lib/mailer'
import { checkOtpLimit, checkLoginLimit } from '@/lib/rate-limit'

const OTP_TTL_MINUTES = 5  // Must match Supabase Auth → Email → OTP expiration (currently 300s)

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const maskedEmail = `${normalizedEmail.slice(0, 2)}****`

    // ── 1. Rate limits ───────────────────────────────────────────────
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const [otpLimit, loginLimit] = await Promise.all([
      checkOtpLimit(normalizedEmail),
      checkLoginLimit(ip),
    ])

    if (!otpLimit.success) {
      return NextResponse.json({ error: 'Too many OTP requests. Try again in an hour.' }, { status: 429 })
    }
    if (!loginLimit.success) {
      return NextResponse.json({ error: 'Too many login attempts from this IP. Try again later.' }, { status: 429 })
    }

    // ── 2. Look up CRM user (gate on active + crm_enabled) ──────────
    const { data: user } = await supabaseAdmin
      .from('crm_users')
      .select('id, full_name, is_active, crm_enabled')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (!user || !user.is_active || !user.crm_enabled) {
      // Email-enumeration prevention: identical shape to the success branch.
      return NextResponse.json({ success: true, masked: maskedEmail })
    }

    // ── 3. Generate OTP via Supabase admin API ──────────────────────
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
    })

    if (linkErr || !linkData?.properties?.email_otp) {
      console.error('[send-otp] generateLink failed:', linkErr)
      // Don't leak the failure shape — fall through to the masked-success
      // response so probers can't distinguish "user exists but Supabase
      // misconfigured" from "user doesn't exist".
      return NextResponse.json({ success: true, masked: maskedEmail })
    }

    const otp = linkData.properties.email_otp

    // ── 4. Email the OTP via our branded template ───────────────────
    await sendOtpEmail({
      to: normalizedEmail,
      name: user.full_name,
      otp,
      expiresInMinutes: OTP_TTL_MINUTES,
    })

    return NextResponse.json({ success: true, masked: maskedEmail })
  } catch (err) {
    console.error('[send-otp]', err)
    return NextResponse.json({ error: 'Failed to send OTP. Try again.' }, { status: 500 })
  }
}
