/**
 * Step 2 of accepting an invite: verify OTP, then provision the
 * identity + membership + crm_users (and employees, if the invite
 * granted hrms_access too).
 * Per IMPERIAL_TENANT_SPEC v1.0 §6.2.
 *
 * Token comes from the URL (passed in the request body too — it survives
 * the OTP round-trip on the client). We look up the invite by token,
 * verify the OTP separately against the invited email, then provision.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyOtpChallenge } from '@/lib/otp'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const { token, otp, challengeToken, full_name } = await req.json()
    if (!token || !otp || !challengeToken) {
      return NextResponse.json({ error: 'token, otp, challengeToken required' }, { status: 400 })
    }

    // Resolve the invite from the token
    const { data: invite } = (await supabaseAdmin
      .from('org_invitations')
      .select('id, org_id, email, role, hrms_access, crm_access, invited_by, created_at, accepted_at, cancelled_at, expires_at')
      .eq('token', token)
      .maybeSingle()) as {
        data: {
          id: string
          org_id: string
          email: string
          role: string
          hrms_access: boolean
          crm_access: boolean
          invited_by: string
          created_at: string
          accepted_at: string | null
          cancelled_at: string | null
          expires_at: string
        } | null
      }

    if (!invite) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    if (invite.accepted_at) return NextResponse.json({ error: 'Invitation already accepted' }, { status: 409 })
    if (invite.cancelled_at) return NextResponse.json({ error: 'Invitation cancelled' }, { status: 410 })
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitation expired' }, { status: 410 })
    }

    const normalizedEmail = invite.email.trim().toLowerCase()

    // Verify OTP against the invited email — proves ownership of the inbox.
    const verified = verifyOtpChallenge({ email: normalizedEmail, otp, challengeToken })
    if (!verified.valid) {
      return NextResponse.json({ error: verified.error ?? 'Invalid OTP' }, { status: 401 })
    }

    // Identity: reuse if it already exists for this email, else create.
    let identityId: string
    {
      const { data: existing } = (await supabaseAdmin
        .from('identities').select('id').eq('email', normalizedEmail).maybeSingle()) as { data: { id: string } | null }

      if (existing) {
        identityId = existing.id
      } else {
        if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
          return NextResponse.json({ error: 'full_name required to create your account' }, { status: 400 })
        }
        const { data: created, error: idErr } = (await supabaseAdmin
          .from('identities')
          .insert({
            email: normalizedEmail,
            full_name: full_name.trim(),
            email_verified_at: new Date().toISOString(),
          } as never)
          .select('id').single()) as { data: { id: string } | null; error: { message: string } | null }
        if (idErr || !created) {
          return NextResponse.json({ error: idErr?.message ?? 'Identity create failed' }, { status: 500 })
        }
        identityId = created.id

        // Mirror the identity into auth.users with the SAME UUID so the
        // invitee can log in via Supabase Auth OTP afterwards. Required
        // for Phase D's verify-otp flow to find them.
        const { error: authErr } = await supabaseAdmin.auth.admin.createUser({
          id: identityId,
          email: normalizedEmail,
          email_confirm: true,
        })
        if (authErr) {
          // Roll back the identity insert so we don't leave a half-provisioned user.
          await supabaseAdmin.from('identities').delete().eq('id', identityId)
          return NextResponse.json(
            { error: `Could not provision Supabase Auth user: ${authErr.message}` },
            { status: 500 },
          )
        }
      }
    }

    // Defensive: race-protect against double-accept.
    {
      const { data: existingMembership } = (await supabaseAdmin
        .from('memberships')
        .select('id')
        .eq('identity_id', identityId)
        .eq('org_id', invite.org_id)
        .maybeSingle()) as { data: { id: string } | null }
      if (existingMembership) {
        await supabaseAdmin
          .from('org_invitations')
          .update({ accepted_at: new Date().toISOString() } as never)
          .eq('id', invite.id)
        return NextResponse.json({ success: true, redirectTo: '/login', alreadyMember: true })
      }
    }

    const { data: membership, error: memErr } = (await supabaseAdmin
      .from('memberships')
      .insert({
        identity_id: identityId,
        org_id: invite.org_id,
        role: invite.role,
        status: 'active',
        hrms_access: invite.hrms_access,
        crm_access: invite.crm_access,
        invited_by: invite.invited_by,
        invited_at: invite.created_at,
        accepted_at: new Date().toISOString(),
      } as never)
      .select('id').single()) as { data: { id: string } | null; error: { message: string } | null }

    if (memErr || !membership) {
      return NextResponse.json({ error: 'Membership create failed', detail: memErr?.message }, { status: 500 })
    }

    await supabaseAdmin
      .from('org_invitations')
      .update({ accepted_at: new Date().toISOString() } as never)
      .eq('id', invite.id)

    // Profile rows. Only create what the membership grants.
    const personName = (full_name && typeof full_name === 'string' ? full_name.trim() : '') || normalizedEmail

    if (invite.crm_access) {
      await supabaseAdmin
        .from('crm_users')
        .insert({
          org_id: invite.org_id,
          identity_id: identityId,
          membership_id: membership.id,
          email: normalizedEmail,
          full_name: personName,
          role: invite.role === 'crm_admin' ? 'admin' : invite.role,
          is_active: true,
          crm_enabled: true,
        } as never)
        .then(({ error }) => {
          if (error) console.warn('[team/accept/complete] crm_users insert non-fatal:', error.message)
        })
    }

    if (invite.hrms_access) {
      const firstName = personName.split(' ')[0] ?? personName
      const lastName = personName.split(' ').slice(1).join(' ') || '-'
      await supabaseAdmin
        .from('employees')
        .insert({
          org_id: invite.org_id,
          identity_id: identityId,
          membership_id: membership.id,
          emp_id: `EMP-${Date.now().toString(36).toUpperCase()}`,
          first_name: firstName,
          last_name: lastName,
          work_email: normalizedEmail,
          role: invite.role === 'hr_admin' ? 'hr_admin' : (invite.role === 'manager' ? 'manager' : 'employee'),
          is_admin: ['owner', 'admin', 'hr_admin'].includes(invite.role),
          status: 'active',
          date_of_joining: new Date().toISOString().split('T')[0],
        } as never)
        .then(({ error }) => {
          if (error) console.warn('[team/accept/complete] employee insert non-fatal:', error.message)
        })
    }

    logAudit({
      org_id: invite.org_id,
      actor_id: identityId,
      action: 'team.invite.accepted',
      resource_type: 'membership',
      resource_id: membership.id,
      meta: { email: normalizedEmail, role: invite.role, hrms_access: invite.hrms_access, crm_access: invite.crm_access },
    })

    return NextResponse.json({ success: true, redirectTo: '/login' })
  } catch (err) {
    console.error('[team/accept/complete POST]', err)
    const message = err instanceof Error ? err.message : 'Accept failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
