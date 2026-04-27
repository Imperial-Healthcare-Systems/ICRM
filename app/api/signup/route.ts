import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createOtpChallenge } from '@/lib/otp'
import { sendOtpEmail, sendWelcomeEmail } from '@/lib/mailer'
import { logAudit } from '@/lib/audit'
import { checkOtpLimit } from '@/lib/rate-limit'

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

    const otpLimit = await checkOtpLimit(normalizedEmail)
    if (!otpLimit.success) {
      return NextResponse.json({ error: 'Too many signup attempts. Try again in an hour.' }, { status: 429 })
    }

    // Check if org with same email already exists
    const { data: existingUser } = await supabaseAdmin
      .from('crm_users')
      .select('id')
      .eq('email', normalizedEmail)
      .single()

    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists. Please sign in.' }, { status: 409 })
    }

    // Create organisation
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 14)

    const { data: org, error: orgError } = await supabaseAdmin
      .from('organisations')
      .insert({
        name: org_name.trim(),
        slug: org_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36),
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

    // Create super_admin user
    const { data: user, error: userError } = await supabaseAdmin
      .from('crm_users')
      .insert({
        org_id: org.id,
        email: normalizedEmail,
        full_name: full_name.trim(),
        role: 'super_admin',
        is_active: true,
        crm_enabled: true,
      })
      .select('id')
      .single()

    if (userError || !user) {
      // Rollback org
      await supabaseAdmin.from('organisations').delete().eq('id', org.id)
      return NextResponse.json({ error: 'Failed to create user account. Try again.' }, { status: 500 })
    }

    // Default pipeline stages
    const { error: stageError } = await supabaseAdmin.from('crm_pipeline_stages').insert(
      DEFAULT_PIPELINE_STAGES.map(s => ({ ...s, org_id: org.id }))
    )
    if (stageError) console.error('[signup] pipeline stages insert:', stageError)

    // Seed org_credits (100 free credits on signup)
    await supabaseAdmin.from('org_credits').insert({
      org_id: org.id,
      balance: 100,
      total_purchased: 100,
    })

    // Send OTP for first login
    const { otp, challengeToken, expiresInMinutes } = createOtpChallenge(normalizedEmail)

    await sendOtpEmail({ to: normalizedEmail, name: full_name.trim(), otp, expiresInMinutes })

    // Fire welcome email (non-blocking)
    sendWelcomeEmail({
      to: normalizedEmail,
      name: full_name.trim(),
      orgName: org_name.trim(),
      planTier: plan_tier,
    }).catch(() => {})

    logAudit({
      org_id: org.id,
      actor_id: user.id,
      action: 'org.created',
      resource_type: 'organisation',
      resource_id: org.id,
      meta: { plan_tier },
    })

    return NextResponse.json({ success: true, challengeToken, orgId: org.id })
  } catch (err) {
    console.error('[signup]', err)
    return NextResponse.json({ error: 'Signup failed. Please try again.' }, { status: 500 })
  }
}
