import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkReadLimit } from '@/lib/rate-limit'

type Comm = {
  id: string
  channel: 'call' | 'meeting' | 'email' | 'note' | 'task' | 'campaign'
  direction: 'in' | 'out' | 'internal'
  subject: string
  body: string
  contact_id: string | null
  contact_name: string | null
  account_id: string | null
  user_id: string | null
  user_name: string | null
  status: string | null
  occurred_at: string
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user
  const limit = await checkReadLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const url = new URL(req.url)
  const channel = url.searchParams.get('channel') ?? ''
  const contactId = url.searchParams.get('contact_id') ?? ''
  const accountId = url.searchParams.get('account_id') ?? ''
  const limitN = Math.min(Number(url.searchParams.get('limit') ?? 100), 300)

  const collected: Comm[] = []

  // 1. Activities (calls, meetings, emails, tasks)
  if (!channel || ['call', 'meeting', 'email', 'task'].includes(channel)) {
    let q = supabaseAdmin
      .from('crm_activities')
      .select(`id, activity_type, subject, description, status, completed_at, scheduled_at, contact_id, account_id, assigned_to, crm_contacts!contact_id(full_name), crm_users!assigned_to(full_name)`)
      .eq('org_id', orgId)
      .order('scheduled_at', { ascending: false })
      .limit(limitN)
    if (contactId) q = q.eq('contact_id', contactId)
    if (accountId) q = q.eq('account_id', accountId)
    if (channel) q = q.eq('activity_type', channel)
    const { data } = await q
    for (const a of (data ?? []) as any[]) {
      const t = a.activity_type as string
      const ch = (['call', 'meeting', 'email', 'task'].includes(t) ? t : 'task') as Comm['channel']
      collected.push({
        id: a.id,
        channel: ch,
        direction: 'internal',
        subject: a.subject ?? '',
        body: a.description ?? '',
        contact_id: a.contact_id,
        contact_name: a.crm_contacts?.full_name ?? null,
        account_id: a.account_id,
        user_id: a.assigned_to,
        user_name: a.crm_users?.full_name ?? null,
        status: a.status,
        occurred_at: a.completed_at ?? a.scheduled_at ?? a.created_at,
      })
    }
  }

  // 2. Notes
  if (!channel || channel === 'note') {
    let q = supabaseAdmin
      .from('crm_notes')
      .select(`id, content, related_to_type, related_to_id, created_by, created_at, crm_users!created_by(full_name)`)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limitN)
    if (contactId) q = q.eq('related_to_type', 'contact').eq('related_to_id', contactId)
    else if (accountId) q = q.eq('related_to_type', 'account').eq('related_to_id', accountId)
    const { data } = await q
    for (const n of (data ?? []) as any[]) {
      collected.push({
        id: n.id,
        channel: 'note',
        direction: 'internal',
        subject: '',
        body: n.content ?? '',
        contact_id: n.related_to_type === 'contact' ? n.related_to_id : null,
        contact_name: null,
        account_id: n.related_to_type === 'account' ? n.related_to_id : null,
        user_id: n.created_by,
        user_name: n.crm_users?.full_name ?? null,
        status: null,
        occurred_at: n.created_at,
      })
    }
  }

  // 3. Campaigns sent (broadcast emails / WhatsApp)
  if ((!channel || channel === 'campaign') && !contactId && !accountId) {
    const { data } = await supabaseAdmin
      .from('crm_campaigns')
      .select('id, name, type, subject, body, status, sent_at, recipient_count, created_at')
      .eq('org_id', orgId)
      .in('status', ['sending', 'sent'])
      .order('sent_at', { ascending: false, nullsFirst: false })
      .limit(50)
    for (const c of (data ?? []) as any[]) {
      collected.push({
        id: c.id,
        channel: 'campaign',
        direction: 'out',
        subject: c.subject ?? c.name ?? '',
        body: c.body ?? `${c.type.toUpperCase()} broadcast → ${c.recipient_count ?? 0} recipients`,
        contact_id: null,
        contact_name: null,
        account_id: null,
        user_id: null,
        user_name: null,
        status: c.status,
        occurred_at: c.sent_at ?? c.created_at,
      })
    }
  }

  collected.sort((a, b) => new Date(b.occurred_at ?? 0).getTime() - new Date(a.occurred_at ?? 0).getTime())
  return NextResponse.json({ data: collected.slice(0, limitN) })
}
