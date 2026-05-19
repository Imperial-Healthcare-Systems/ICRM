/**
 * Impersonation zombie-session sweeper — defensive backstop for §8.3.
 *
 * The spec-compliant end path is /api/auth/impersonation-end, fired by the
 * "End Session" button in the impersonation banner. If the admin closes
 * the tab or navigates away without clicking it, `platform_impersonation_log.ended_at`
 * stays NULL forever and the tenant never sees the session close in their audit.
 *
 * This sweep runs hourly: anything older than IMPERSONATION_MAX_HOURS (default 4)
 * gets `ended_at` stamped + a `imperial.impersonation_ended` audit row written
 * with reason='auto-closed by sweeper' so the customer still sees the close.
 *
 * Auth: CRON_SECRET bearer (same pattern as the other cron routes).
 *
 * Vercel Cron schedule recommendation: `0 * * * *` (top of every hour).
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const MAX_HOURS = Number(process.env.IMPERSONATION_MAX_HOURS ?? '4')

function verifyCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

type LogRow = {
  id: string
  admin_id: string
  impersonated_org_id: string
  started_at: string
}

async function handle(req: NextRequest) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const cutoff = new Date(Date.now() - MAX_HOURS * 3600 * 1000).toISOString()

  const { data: zombies } = await supabaseAdmin
    .from('platform_impersonation_log')
    .select('id, admin_id, impersonated_org_id, started_at')
    .is('ended_at', null)
    .lt('started_at', cutoff) as { data: LogRow[] | null }

  if (!zombies || zombies.length === 0) {
    return NextResponse.json({ swept: 0, max_hours: MAX_HOURS, cutoff })
  }

  // Resolve admin emails in one shot for the audit row payload.
  const adminIds = Array.from(new Set(zombies.map(z => z.admin_id)))
  const { data: admins } = await supabaseAdmin
    .from('identities')
    .select('id, email')
    .in('id', adminIds)
  const emailById = new Map((admins ?? []).map(a => [a.id as string, a.email as string]))

  const now = new Date().toISOString()
  let swept = 0
  for (const z of zombies) {
    const { error: upErr } = await supabaseAdmin
      .from('platform_impersonation_log')
      .update({ ended_at: now } as never)
      .eq('id', z.id)
      .is('ended_at', null)
    if (upErr) {
      console.error('[cron/impersonation-sweep] update FAILED', upErr.message, { log_id: z.id })
      continue
    }

    await supabaseAdmin
      .from('tenant_visible_audit')
      .insert({
        org_id: z.impersonated_org_id,
        event_type: 'imperial.impersonation_ended',
        imperial_admin_email: emailById.get(z.admin_id) ?? 'imperial-admin',
        reason: `Auto-closed by sweeper (session exceeded ${MAX_HOURS}h, admin did not click End Session)`,
        reference_type: 'impersonation_log',
        reference_id: z.id,
        metadata: { auto_swept: true, started_at: z.started_at, swept_at: now },
      } as never)
      .then(({ error }) => {
        if (error) console.error('[cron/impersonation-sweep] tenant_visible_audit INSERT FAILED', error.message, { log_id: z.id })
      })

    swept++
  }

  return NextResponse.json({ swept, max_hours: MAX_HOURS, cutoff, sample: zombies.slice(0, 3).map(z => z.id) })
}

export async function GET(req: NextRequest)  { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }
