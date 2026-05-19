import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendOtpEmail, sendWelcomeEmail } from '@/lib/mailer'
import { logAudit } from '@/lib/audit'
import { checkOtpLimit } from '@/lib/rate-limit'

const OTP_TTL_MINUTES = 5  // Must match Supabase Auth → Email → OTP expiration (currently 300s)

const DEFAULT_PIPELINE_STAGES = [
  { name: 'Qualification', position: 0, probability: 10,  color: '#6B7280', is_won: false, is_lost: false },
  { name: 'Proposal Sent', position: 1, probability: 30,  color: '#3B82F6', is_won: false, is_lost: false },
  { name: 'Demo Done',     position: 2, probability: 50,  color: '#8B5CF6', is_won: false, is_lost: false },
  { name: 'Negotiation',   position: 3, probability: 70,  color: '#F59E0B', is_won: false, is_lost: false },
  { name: 'Won',           position: 4, probability: 100, color: '#10B981', is_won: true,  is_lost: false },
  { name: 'Lost',          position: 5, probability: 0,   color: '#EF4444', is_won: false, is_lost: true  },
]

export async function POST(req: NextRequest) {
  try {
    const { org_name, full_name, email, phone, gstin, plan_tier = 'starter' } = await req.json()

    if (!org_name || !full_name || !email) {
      return NextResponse.json({ error: 'org_name, full_name, and email are required.' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const trimmedName = full_name.trim()
    const trimmedOrgName = org_name.trim()

    const otpLimit = await checkOtpLimit(normalizedEmail)
    if (!otpLimit.success) {
      return NextResponse.json({ error: 'Too many signup attempts. Try again in an hour.' }, { status: 429 })
    }

    const { data: existingUser } = await supabaseAdmin
      .from('crm_users')
      .select('id')
      .eq('email', normalizedEmail)
      .single()

    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists. Please sign in.' }, { status: 409 })
    }

    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 14)

    const { data: org, error: orgError } = await supabaseAdmin
      .from('organisations')
      .insert({
        name: trimmedOrgName,
        slug: trimmedOrgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36),
        billing_email: normalizedEmail,
        phone: phone?.trim() ?? null,
        gstin: gstin?.trim() ?? null,
        plan_tier,
        subscription_status: 'trial',
        trial_ends_at: trialEnd.toISOString(),
        icrm_enabled: true,
      })
      .select('id')
      .single()

    if (orgError || !org) {
      console.error('[signup] org insert error:', orgError)
      return NextResponse.json({ error: 'Failed to create organisation. Try again.' }, { status: 500 })
    }

    let { data: identity } = await supabaseAdmin
      .from('identities')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (!identity) {
      const { data: newIdentity, error: identityError } = await supabaseAdmin
        .from('identities')
        .insert({
          email: normalizedEmail,
          full_name: trimmedName,
          phone: phone?.trim() ?? null,
          last_active_org_id: org.id,
        })
        .select('id')
        .single()

      if (identityError || !newIdentity) {
        await supabaseAdmin.from('organisations').delete().eq('id', org.id)
        console.error('[signup] identity insert error:', identityError)
        return NextResponse.json({ error: 'Failed to create identity. Try again.' }, { status: 500 })
      }
      identity = newIdentity

      // Mirror to auth.users with the same UUID so login via Supabase OTP works.
      const { error: authErr } = await supabaseAdmin.auth.admin.createUser({
        id: identity.id,
        email: normalizedEmail,
        email_confirm: true,
      })
      if (authErr) {
        await supabaseAdmin.from('identities').delete().eq('id', identity.id)
        await supabaseAdmin.from('organisations').delete().eq('id', org.id)
        console.error('[signup] auth.admin.createUser failed:', authErr)
        return NextResponse.json(
          { error: `Could not provision Supabase Auth user: ${authErr.message}` },
          { status: 500 },
        )
      }
    } else {
      await supabaseAdmin
        .from('identities')
        .update({ last_active_org_id: org.id, updated_at: new Date().toISOString() })
        .eq('id', identity.id)
    }

    const { data: membership, error: memError } = await supabaseAdmin
      .from('memberships')
      .insert({
        identity_id: identity.id,
        org_id: org.id,
        role: 'owner',
        status: 'active',
        crm_access: true,
        hrms_access: false,
        accepted_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (memError || !membership) {
      await supabaseAdmin.from('organisations').delete().eq('id', org.id)
      console.error('[signup] membership insert error:', memError)
      return NextResponse.json({ error: 'Failed to create membership. Try again.' }, { status: 500 })
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('crm_users')
      .insert({
        org_id: org.id,
        email: normalizedEmail,
        full_name: trimmedName,
        role: 'super_admin',
        is_active: true,
        crm_enabled: true,
        identity_id: identity.id,
        membership_id: membership.id,
      })
      .select('id')
      .single()

    if (userError || !user) {
      await supabaseAdmin.from('memberships').delete().eq('id', membership.id)
      await supabaseAdmin.from('organisations').delete().eq('id', org.id)
      return NextResponse.json({ error: 'Failed to create user account. Try again.' }, { status: 500 })
    }

    const { error: stageError } = await supabaseAdmin.from('crm_pipeline_stages').insert(
      DEFAULT_PIPELINE_STAGES.map(s => ({ ...s, org_id: org.id }))
    )
    if (stageError) console.error('[signup] pipeline stages insert:', stageError)

    await supabaseAdmin.from('org_credits').insert({
      org_id: org.id,
      balance: 100,
      total_purchased: 100,
    })

    await supabaseAdmin.from('org_branding').insert({
      org_id: org.id,
      level: 'none',
    })

    const { data: plan } = await supabaseAdmin
      .from('subscription_plans')
      .select('price_per_seat_inr')
      .eq('product', 'icrm')
      .eq('tier', plan_tier)
      .eq('is_active', true)
      .maybeSingle()

    await supabaseAdmin.from('org_subscriptions').insert({
      org_id: org.id,
      product: 'icrm',
      tier: plan_tier,
      seats: 1,
      amount_per_month: plan?.price_per_seat_inr ?? 0,
      currency: 'INR',
      status: 'trial',
      billing_cycle: 'monthly',
      trial_ends_at: trialEnd.toISOString(),
      current_period_start: new Date().toISOString(),
      current_period_end: trialEnd.toISOString(),
      next_billing_date: trialEnd.toISOString(),
    })

    // Mint a Supabase Auth OTP via admin.generateLink and email it via our
    // branded template — same pattern as /api/auth/send-otp.
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
    })
    if (linkErr || !linkData?.properties?.email_otp) {
      console.error('[signup] generateLink failed (non-fatal — user can resend from /login):', linkErr)
    } else {
      await sendOtpEmail({
        to: normalizedEmail,
        name: trimmedName,
        otp: linkData.properties.email_otp,
        expiresInMinutes: OTP_TTL_MINUTES,
      })
    }

    sendWelcomeEmail({
      to: normalizedEmail,
      name: trimmedName,
      orgName: trimmedOrgName,
      planTier: plan_tier,
    }).catch(() => {})

    logAudit({
      org_id: org.id,
      actor_id: user.id,
      action: 'org.created',
      resource_type: 'organisation',
      resource_id: org.id,
      meta: { plan_tier, identity_id: identity.id, membership_id: membership.id },
    })

    return NextResponse.json({ success: true, orgId: org.id, email: normalizedEmail })
  } catch (err) {
    console.error('[signup]', err)
    return NextResponse.json({ error: 'Signup failed. Please try again.' }, { status: 500 })
  }
}
