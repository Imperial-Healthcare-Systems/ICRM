import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function verifyCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const today = new Date()
  const alertWindow = new Date(today)
  alertWindow.setDate(today.getDate() + 60) // look ahead 60 days

  // Find active contracts expiring within their renewal_notice_days
  const { data: contracts } = await supabaseAdmin
    .from('crm_contracts')
    .select(`
      id, org_id, title, end_date, renewal_notice_days, contract_number,
      crm_accounts!account_id(name)
    `)
    .eq('status', 'active')
    .not('end_date', 'is', null)
    .lte('end_date', alertWindow.toISOString().split('T')[0])
    .gte('end_date', today.toISOString().split('T')[0])

  if (!contracts?.length) return NextResponse.json({ alerted: 0 })

  let alerted = 0

  for (const contract of contracts) {
    const endDate = new Date(contract.end_date)
    const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    const noticeDays = contract.renewal_notice_days ?? 30

    if (daysLeft > noticeDays) continue

    // Check matching automation rules for contract.expiring
    const { data: rules } = await supabaseAdmin
      .from('crm_automation_rules')
      .select('id, action_type, action_config')
      .eq('org_id', contract.org_id)
      .eq('trigger_event', 'contract.expiring')
      .eq('is_active', true)

    // Check if already alerted (automation execution log)
    for (const rule of rules ?? []) {
      const { data: existing } = await supabaseAdmin
        .from('crm_automation_executions')
        .select('id')
        .eq('rule_id', rule.id)
        .eq('resource_id', contract.id)
        .single()

      if (existing) continue

      // Add note on the contract
      await supabaseAdmin.from('crm_notes').insert({
        org_id: contract.org_id,
        content: `⚠️ Contract "${contract.title}" (${contract.contract_number}) expires in ${daysLeft} day(s) on ${contract.end_date}.`,
        related_to_type: 'contract',
        related_to_id: contract.id,
      })

      await supabaseAdmin.from('crm_automation_executions').upsert({
        org_id: contract.org_id,
        rule_id: rule.id,
        resource_id: contract.id,
      }, { onConflict: 'rule_id,resource_id', ignoreDuplicates: true })

      await supabaseAdmin.rpc('increment_rule_run_count', { p_rule_id: rule.id })

      alerted++
    }

    // Even without a rule, create a note if no automation handled it
    if (!rules?.length) {
      await supabaseAdmin.from('crm_notes').insert({
        org_id: contract.org_id,
        content: `⚠️ Contract "${contract.title}" (${contract.contract_number}) expires in ${daysLeft} day(s) on ${contract.end_date}.`,
        related_to_type: 'contract',
        related_to_id: contract.id,
      })
      alerted++
    }
  }

  return NextResponse.json({ alerted, total: contracts.length })
}
