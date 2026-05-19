/**
 * Step 1 of accepting an invite: send an OTP to verify the invitee
 * controls the email address on the invitation.
 * Per IMPERIAL_TENANT_SPEC v1.0 §6.2.
 *
 * Public endpoint (no session). The token resolves the invite; the OTP
 * proves email ownership. Step 2 — /api/team/accept/complete — verifies
 * the OTP and provisions identity + membership + crm_users.
 *
 * Note: ICRM's createOtpChallenge takes only `email`, not the IHRMS-style
 * `{ email, payload }`. We don't try to thread invite_id through the
 * challenge — accept/complete looks the invite up by token (the same
 * token from the URL) and verifies the OTP against the email.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createOtpChallenge } from '@/lib/otp'
import { sendOtpEmail } from '@/lib/mailer'

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

    const { data: invite } = (await supabaseAdmin
      .from('org_invitations')
      .select(`
        id, org_id, email, role, hrms_access, crm_access, expires_at,
        organisations ( name )
      `)
      .eq('token', token)
      .is('accepted_at', null)
      .is('cancelled_at', null)
      .maybeSingle()) as {
        data: {
          id: string
          org_id: string
          email: string
          role: string
          hrms_access: boolean
          crm_access: boolean
          expires_at: string
          organisations: { name: string } | { name: string }[] | null
        } | null
      }

    if (!invite) {
      return NextResponse.json({ error: 'Invitation not found or already used' }, { status: 404 })
    }
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitation expired' }, { status: 410 })
    }

    const challenge = createOtpChallenge(invite.email)

    try {
      await sendOtpEmail({
        to: invite.email,
        name: invite.email.split('@')[0] ?? 'there',
        otp: challenge.otp,
        expiresInMinutes: challenge.expiresInMinutes,
      })
    } catch (mailErr) {
      if (process.env.NODE_ENV !== 'production') {
        console.info(`[ICRM Invite OTP] ${invite.email}: ${challenge.otp}`)
        return NextResponse.json({
          success: true,
          challengeToken: challenge.challengeToken,
          orgName: Array.isArray(invite.organisations)
            ? invite.organisations[0]?.name
            : invite.organisations?.name ?? 'an organisation',
          role: invite.role,
          email: invite.email,
          message: 'SMTP not configured — OTP printed to server log.',
          devOtp: challenge.otp,
        })
      }
      throw mailErr
    }

    return NextResponse.json({
      success: true,
      challengeToken: challenge.challengeToken,
      orgName: Array.isArray(invite.organisations)
        ? invite.organisations[0]?.name
        : invite.organisations?.name ?? 'an organisation',
      role: invite.role,
      email: invite.email,
    })
  } catch (err) {
    console.error('[team/accept POST]', err)
    const message = err instanceof Error ? err.message : 'Accept request failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
