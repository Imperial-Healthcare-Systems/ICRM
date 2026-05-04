import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { sendInviteEmail } from '@/lib/mailer'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const { role: actorRole, orgId, id: actorId } = session.user

    if (!['super_admin', 'admin'].includes(actorRole)) {
      return NextResponse.json({ error: 'Only admins can invite users.' }, { status: 403 })
    }

    const { email, full_name, role } = await req.json()

    if (!email || !full_name || !role) {
      return NextResponse.json({ error: 'email, full_name, and role are required.' }, { status: 400 })
    }

    const allowedRoles = ['admin', 'manager', 'sales_rep', 'support_rep', 'viewer']
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role.' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const { data: existing } = await supabaseAdmin
      .from('crm_users')
      .select('id')
      .eq('org_id', orgId)
      .eq('email', normalizedEmail)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists in your organisation.' }, { status: 409 })
    }

    const { data: inviter } = await supabaseAdmin
      .from('crm_users')
      .select('full_name')
      .eq('id', actorId)
      .single()

    const { data: org } = await supabaseAdmin
      .from('organisations')
      .select('name')
      .eq('id', orgId)
      .single()

    const { data: newUser, error } = await supabaseAdmin
      .from('crm_users')
      .insert({
        org_id: orgId,
        email: normalizedEmail,
        full_name,
        role,
        is_active: true,
        crm_enabled: true,
      })
      .select('id')
      .single()

    if (error || !newUser) {
      return NextResponse.json({ error: 'Failed to create user.' }, { status: 500 })
    }

    const loginUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/login`
      : undefined

    await sendInviteEmail({
      to: normalizedEmail,
      name: full_name,
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
      meta: { email: normalizedEmail, role },
    })

    return NextResponse.json({ success: true, userId: newUser.id })
  } catch (err) {
    console.error('[invite]', err)
    return NextResponse.json({ error: 'Invite failed. Try again.' }, { status: 500 })
  }
}
