import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendTrialExpiryEmail } from '@/lib/mailer'

function verifyCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const today = new Date()
  const warningDates = [7, 3, 1].map(d => {
    const dt = new Date(today)
    dt.setDate(today.getDate() + d)
    return dt.toISOString().split('T')[0]
  })

  // Find orgs with trials expiring in 1, 3, or 7 days
  const { data: orgs } = await supabaseAdmin
    .from('organisations')
    .select('id, name, trial_ends_at, plan_tier')
    .eq('subscription_status', 'trial')
    .in('trial_ends_at', warningDates)

  if (!orgs?.length) return NextResponse.json({ notified: 0 })

  let notified = 0

  for (const org of orgs) {
    const trialEnd = new Date(org.trial_ends_at)
    const daysLeft = Math.ceil((trialEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    // Fetch the admin user
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

  // Also lock orgs whose trial expired yesterday
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  await supabaseAdmin
    .from('organisations')
    .update({ subscription_status: 'suspended' })
    .eq('subscription_status', 'trial')
    .lt('trial_ends_at', today.toISOString().split('T')[0])

  return NextResponse.json({ notified })
}
