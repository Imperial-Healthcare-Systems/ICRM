import { NextRequest, NextResponse } from 'next/server'
import { requireWriteAccess } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { sendInviteEmail } from '@/lib/mailer'
import { logAudit } from '@/lib/audit'

const CRM_TO_MEMBERSHIP_ROLE: Record<string, string> = {
  admin: 'admin',
  manager: 'manager',
  sales_rep: 'member',
  support_rep: 'member',
  viewer: 'viewer',
}

export async function POST(req: NextRequest) {
  try {
    const { session, supabase, error } = await requireWriteAccess()
    if (error) return error

    const { role: actorRole, orgId, id: actorId } = session.user

    if (!['super_admin', 'admin'].includes(actorRole)) {
      return NextResponse.json({ error: 'Only admins can invite users.' }, { status: 403 })
    }

    const { email, full_name, role } = await req.json()

    if (!email || !full_name || !role) {
      return NextResponse.json({ error: 'email, full_name, and role are required.' }, { status: 400 })
    }

    if (!Object.keys(CRM_TO_MEMBERSHIP_ROLE).includes(role)) {
      return NextResponse.json({ error: 'Invalid role.' }, { status: 400 })
    }

    const membershipRole = CRM_TO_MEMBERSHIP_ROLE[role]
    const normalizedEmail = email.trim().toLowerCase()
    const trimmedName = full_name.trim()

    const { data: existing } = await supabase
      .from('crm_users')
      .select('id')
      .eq('org_id', orgId)
      .eq('email', normalizedEmail)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists in your organisation.' }, { status: 409 })
    }

    const { data: inviter } = await supabase
      .from('crm_users')
      .select('full_name')
      .eq('id', actorId)
      .single()

    const { data: org } = await supabase
      .from('organisations')
      .select('name')
      .eq('id', orgId)
      .single()

    let { data: identity } = await supabaseAdmin
      .from('identities')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (!identity) {
      const { data: newIdentity, error: identityError } = await supabaseAdmin
        .from('identities')
        .insert({ email: normalizedEmail, full_name: trimmedName })
        .select('id')
        .single()

      if (identityError || !newIdentity) {
        console.error('[invite] identity insert error:', identityError)
        return NextResponse.json({ error: 'Failed to create identity.' }, { status: 500 })
      }
      identity = newIdentity
    }

    const { data: existingMembership } = await supabaseAdmin
      .from('memberships')
      .select('id, status')
      .eq('identity_id', identity.id)
      .eq('org_id', orgId)
      .maybeSingle()

    if (existingMembership && existingMembership.status === 'active') {
      return NextResponse.json({ error: 'This user already has access to your organisation.' }, { status: 409 })
    }

    let membershipId: string
    if (existingMembership) {
      const { data: reactivated, error: updateError } = await supabaseAdmin
        .from('memberships')
        .update({
          role: membershipRole,
          status: 'active',
          crm_access: true,
          invited_by: actorId,
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingMembership.id)
        .select('id')
        .single()

      if (updateError || !reactivated) {
        return NextResponse.json({ error: 'Failed to reactivate membership.' }, { status: 500 })
      }
      membershipId = reactivated.id
    } else {
      const { data: newMembership, error: memError } = await supabaseAdmin
        .from('memberships')
        .insert({
          identity_id: identity.id,
          org_id: orgId,
          role: membershipRole,
          status: 'active',
          crm_access: true,
          hrms_access: false,
          invited_by: actorId,
          accepted_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (memError || !newMembership) {
        console.error('[invite] membership insert error:', memError)
        return NextResponse.json({ error: 'Failed to create membership.' }, { status: 500 })
      }
      membershipId = newMembership.id
    }

    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('crm_users')
      .insert({
        org_id: orgId,
        email: normalizedEmail,
        full_name: trimmedName,
        role,
        is_active: true,
        crm_enabled: true,
        identity_id: identity.id,
        membership_id: membershipId,
      })
      .select('id')
      .single()

    if (insertError || !newUser) {
      await supabaseAdmin.from('memberships').delete().eq('id', membershipId)
      console.error('[invite] crm_users insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create user.' }, { status: 500 })
    }

    const loginUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/login`
      : undefined

    await sendInviteEmail({
      to: normalizedEmail,
      name: trimmedName,
      invitedBy: inviter?.full_name ?? 'Administrator',
      orgName: org?.name ?? 'your organisation',
      role,
      loginUrl,
    })

    logAudit({
      org_id: orgId,
      actor_id: actorId,
      action: 'user.invited',
      resource_type: 'crm_user',
      resource_id: newUser.id,
      meta: { email: normalizedEmail, role, identity_id: identity.id, membership_id: membershipId },
    })

    return NextResponse.json({ success: true, userId: newUser.id })
  } catch (err) {
    console.error('[invite]', err)
    return NextResponse.json({ error: 'Invite failed. Try again.' }, { status: 500 })
  }
}
