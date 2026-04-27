import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function verifyCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  // Daily: find orgs with low credit balances and queue alerts
  const { data: lowCreditOrgs } = await supabaseAdmin
    .from('org_credits')
    .select('org_id, balance')
    .lt('balance', 10)
    .gt('balance', 0)

  let alerted = 0

  for (const row of lowCreditOrgs ?? []) {
    const { data: admin } = await supabaseAdmin
      .from('crm_users')
      .select('full_name, email')
      .eq('org_id', row.org_id)
      .eq('role', 'super_admin')
      .single()

    const { data: org } = await supabaseAdmin
      .from('organisations')
      .select('name')
      .eq('id', row.org_id)
      .single()

    if (!admin || !org) continue

    // Import dynamically to avoid circular deps in cron context
    const { sendCreditAlertEmail } = await import('@/lib/mailer')
    try {
      await sendCreditAlertEmail({
        to: admin.email,
        name: admin.full_name,
        orgName: org.name,
        creditsRemaining: row.balance,
        topUpUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://imperialcrm.cloud'}/billing`,
      })
      alerted++
    } catch {
      // Non-fatal
    }
  }

  return NextResponse.json({ lowCreditOrgsAlerted: alerted })
}
