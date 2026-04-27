import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkMutationLimit } from '@/lib/rate-limit'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { id: sequenceId } = await params

  // Verify sequence belongs to org
  const { data: seq } = await supabaseAdmin
    .from('crm_email_sequences')
    .select('id')
    .eq('id', sequenceId)
    .eq('org_id', orgId)
    .single()

  if (!seq) return NextResponse.json({ error: 'Sequence not found.' }, { status: 404 })

  const body = await req.json()
  const { subject, body: emailBody, delay_days, step_order } = body

  if (!subject?.trim() || !emailBody?.trim()) {
    return NextResponse.json({ error: 'Subject and body are required.' }, { status: 400 })
  }

  // Auto-assign step_order if not provided
  let order = step_order
  if (!order) {
    const { data: lastStep } = await supabaseAdmin
      .from('crm_email_sequence_steps')
      .select('step_order')
      .eq('sequence_id', sequenceId)
      .order('step_order', { ascending: false })
      .limit(1)
      .single()
    order = (lastStep?.step_order ?? 0) + 1
  }

  const { data, error: dbError } = await supabaseAdmin
    .from('crm_email_sequence_steps')
    .insert({
      sequence_id: sequenceId,
      step_order: order,
      delay_days: delay_days ?? 1,
      subject: subject.trim(),
      body: emailBody.trim(),
    })
    .select('id, step_order, delay_days, subject')
    .single()

  if (dbError || !data) return NextResponse.json({ error: 'Failed to add step.' }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
