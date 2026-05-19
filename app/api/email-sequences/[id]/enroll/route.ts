import { NextRequest, NextResponse } from 'next/server'
import { requireWriteAccess } from '@/lib/session'
import { checkMutationLimit } from '@/lib/rate-limit'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, supabase, error } = await requireWriteAccess()
  if (error) return error
  const { orgId } = session.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { id: sequenceId } = await params

  const { data: seq } = await supabase
    .from('crm_email_sequences')
    .select('id, status')
    .eq('id', sequenceId)
    .eq('org_id', orgId)
    .single()

  if (!seq) return NextResponse.json({ error: 'Sequence not found.' }, { status: 404 })
  if (seq.status !== 'active') return NextResponse.json({ error: 'Sequence must be active to enroll contacts.' }, { status: 400 })

  const body = await req.json()
  const { contact_id } = body

  if (!contact_id) return NextResponse.json({ error: 'contact_id is required.' }, { status: 400 })

  const { data: contact } = await supabase
    .from('crm_contacts')
    .select('id')
    .eq('id', contact_id)
    .eq('org_id', orgId)
    .single()

  if (!contact) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 })

  const { data: existing } = await supabase
    .from('crm_email_sequence_enrollments')
    .select('id, status')
    .eq('sequence_id', sequenceId)
    .eq('contact_id', contact_id)
    .eq('org_id', orgId)
    .single()

  if (existing) {
    if (existing.status === 'active') return NextResponse.json({ error: 'Contact is already enrolled.' }, { status: 409 })
    const { data: updated } = await supabase
      .from('crm_email_sequence_enrollments')
      .update({ status: 'active', current_step: 0, next_send_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('id')
      .single()
    return NextResponse.json({ data: updated })
  }

  const { data, error: dbError } = await supabase
    .from('crm_email_sequence_enrollments')
    .insert({
      org_id: orgId,
      sequence_id: sequenceId,
      contact_id,
      status: 'active',
      current_step: 0,
      next_send_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (dbError || !data) return NextResponse.json({ error: 'Enrollment failed.' }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
