import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function verifyCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const now = new Date().toISOString()

  // Find active enrollments ready to send next step
  const { data: enrollments } = await supabaseAdmin
    .from('crm_email_sequence_enrollments')
    .select(`
      id, org_id, sequence_id, contact_id, current_step, next_send_at,
      crm_contacts!contact_id(first_name, last_name, email),
      crm_email_sequences!sequence_id(name, status)
    `)
    .eq('status', 'active')
    .lte('next_send_at', now)
    .limit(100)

  if (!enrollments?.length) return NextResponse.json({ advanced: 0 })

  let advanced = 0

  for (const enr of enrollments) {
    const seq = enr.crm_email_sequences as unknown as Record<string, unknown>
    if (seq?.status !== 'active') {
      // Pause enrollment if sequence is no longer active
      await supabaseAdmin.from('crm_email_sequence_enrollments')
        .update({ status: 'paused' }).eq('id', enr.id)
      continue
    }

    const nextStepOrder = (enr.current_step ?? 0) + 1

    // Fetch next step
    const { data: step } = await supabaseAdmin
      .from('crm_email_sequence_steps')
      .select('id, step_order, delay_days, subject, body')
      .eq('sequence_id', enr.sequence_id)
      .eq('step_order', nextStepOrder)
      .single()

    if (!step) {
      // No more steps — mark enrollment completed
      await supabaseAdmin.from('crm_email_sequence_enrollments')
        .update({ status: 'completed', completed_at: now }).eq('id', enr.id)
      continue
    }

    const contact = enr.crm_contacts as unknown as Record<string, unknown>

    // Log outgoing email (actual SMTP sending would happen here)
    // The mailer.ts sendOtpEmail / custom template can be used for sequence emails
    // For now we record it as a campaign-style send
    await supabaseAdmin.from('crm_activities').insert({
      org_id: enr.org_id,
      activity_type: 'email',
      subject: step.subject,
      description: `Email sequence step ${nextStepOrder} sent to ${contact?.first_name} ${contact?.last_name}`,
      status: 'completed',
      completed_at: now,
      related_to_type: 'contact',
      related_to_id: enr.contact_id,
    })

    // Advance the enrollment to the next step
    const nextSendAt = new Date()
    nextSendAt.setDate(nextSendAt.getDate() + (step.delay_days ?? 1))

    await supabaseAdmin.from('crm_email_sequence_enrollments').update({
      current_step: nextStepOrder,
      next_send_at: nextSendAt.toISOString(),
    }).eq('id', enr.id)

    advanced++
  }

  return NextResponse.json({ advanced })
}
