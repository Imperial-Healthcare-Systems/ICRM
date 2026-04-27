import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createOtpChallenge } from '@/lib/otp'
import { sendOtpEmail } from '@/lib/mailer'
import { checkOtpLimit, checkLoginLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

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

    const { data: user } = await supabaseAdmin
      .from('crm_users')
      .select('id, full_name, is_active, crm_enabled')
      .eq('email', normalizedEmail)
      .single()

    if (!user || !user.is_active || !user.crm_enabled) {
      // Return same response to prevent email enumeration
      return NextResponse.json({ success: true, masked: `${normalizedEmail.slice(0, 2)}****` })
    }

    const { otp, challengeToken, expiresInMinutes } = createOtpChallenge(normalizedEmail)

    await sendOtpEmail({
      to: normalizedEmail,
      name: user.full_name,
      otp,
      expiresInMinutes,
    })

    return NextResponse.json({ success: true, challengeToken, masked: `${normalizedEmail.slice(0, 2)}****` })
  } catch (err) {
    console.error('[send-otp]', err)
    return NextResponse.json({ error: 'Failed to send OTP. Try again.' }, { status: 500 })
  }
}
