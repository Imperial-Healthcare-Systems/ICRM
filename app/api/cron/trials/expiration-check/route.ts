import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendTrialExpiryEmail } from '@/lib/mailer'

function verifyCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

const DAY = 86_400_000

const PAST_DUE_AT_DAYS    = 0
const READ_ONLY_AT_DAYS   = 3
const EXPORT_ONLY_AT_DAYS = 7
const DEACTIVATE_AT_DAYS  = 16

type Subscription = {
  id: string
  org_id: string
  status: string
  trial_ends_at: string | null
  soft_locked_at: string | null
  read_only_at: string | null
  export_only_at: string | null
  deactivated_at: string | null
}

function targetStateFor(daysPast: number): {
  status: string
  fieldName: 'soft_locked_at' | 'read_only_at' | 'export_only_at' | 'deactivated_at'
} {
  if (daysPast >= DEACTIVATE_AT_DAYS)  return { status: 'deactivated', fieldName: 'deactivated_at' }
  if (daysPast >= EXPORT_ONLY_AT_DAYS) return { status: 'export_only', fieldName: 'export_only_at' }
  if (daysPast >= READ_ONLY_AT_DAYS)   return { status: 'read_only',   fieldName: 'read_only_at'   }
  return { status: 'past_due', fieldName: 'soft_locked_at' }
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const now = new Date()
  const today = now.toISOString().split('T')[0]

  const warningDates = [7, 3, 1].map(d => {
    const dt = new Date(now)
    dt.setDate(now.getDate() + d)
    return dt.toISOString().split('T')[0]
  })

  const { data: warningOrgs } = await supabaseAdmin
    .from('organisations')
    .select('id, name, trial_ends_at, plan_tier')
    .eq('subscription_status', 'trial')
    .in('trial_ends_at', warningDates)

  let notified = 0

  for (const org of warningOrgs ?? []) {
    const trialEnd = new Date(org.trial_ends_at)
    const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / DAY)

    const { data: admin } = await supabaseAdmin
      .from('crm_users')
      .select('full_name, email')
      .eq('org_id', org.id)
      .eq('role', 'super_admin')
      .single()

    if (!admin) continue

    try {
      await sendTrialExpiryEmail({
        to: admin.email,
        name: admin.full_name,
        orgName: org.name,
        daysLeft,
        upgradeUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://imperialcrm.cloud'}/settings/billing`,
      })
      notified++
    } catch {
      // Email failures are non-fatal
    }
  }

  const { data: subs } = await supabaseAdmin
    .from('org_subscriptions')
    .select('id, org_id, status, trial_ends_at, soft_locked_at, read_only_at, export_only_at, deactivated_at')
    .in('status', ['trial', 'past_due', 'read_only', 'export_only'])

  const transitions: Array<{ org_id: string; from: string; to: string }> = []

  for (const sub of (subs ?? []) as Subscription[]) {
    if (!sub.trial_ends_at) continue
    const trialEndMs = new Date(sub.trial_ends_at).getTime()
    if (now.getTime() < trialEndMs) continue

    const daysPast = Math.floor((now.getTime() - trialEndMs) / DAY)
    const target = targetStateFor(daysPast)

    if (sub.status === target.status) continue

    const transitionTime = new Date(trialEndMs + {
      soft_locked_at: PAST_DUE_AT_DAYS,
      read_only_at: READ_ONLY_AT_DAYS,
      export_only_at: EXPORT_ONLY_AT_DAYS,
      deactivated_at: DEACTIVATE_AT_DAYS,
    }[target.fieldName] * DAY)

    const updates: Record<string, unknown> = {
      status: target.status,
      updated_at: now.toISOString(),
    }

    if (!sub.soft_locked_at)  updates.soft_locked_at  = new Date(trialEndMs).toISOString()
    if (target.fieldName === 'read_only_at'   && !sub.read_only_at)   updates.read_only_at   = transitionTime.toISOString()
    if (target.fieldName === 'export_only_at' && !sub.export_only_at) updates.export_only_at = transitionTime.toISOString()
    if (target.fieldName === 'deactivated_at' && !sub.deactivated_at) updates.deactivated_at = transitionTime.toISOString()

    if (target.fieldName === 'export_only_at' && !sub.read_only_at) {
      updates.read_only_at = new Date(trialEndMs + READ_ONLY_AT_DAYS * DAY).toISOString()
    }
    if (target.fieldName === 'deactivated_at') {
      if (!sub.read_only_at)   updates.read_only_at   = new Date(trialEndMs + READ_ONLY_AT_DAYS   * DAY).toISOString()
      if (!sub.export_only_at) updates.export_only_at = new Date(trialEndMs + EXPORT_ONLY_AT_DAYS * DAY).toISOString()
    }

    const { error: subErr } = await supabaseAdmin
      .from('org_subscriptions')
      .update(updates)
      .eq('id', sub.id)

    if (subErr) continue

    await supabaseAdmin
      .from('organisations')
      .update({ subscription_status: target.status, updated_at: now.toISOString() })
      .eq('id', sub.org_id)

    transitions.push({ org_id: sub.org_id, from: sub.status, to: target.status })
  }

  return NextResponse.json({
    today,
    notified,
    transitions: transitions.length,
    detail: transitions,
  })
}
