/**
 * Platform AI cost monitor — Phase 7 of IMPERIAL_TENANT_SPEC v1.0 §10.
 * Vercel Cron schedule: hourly (00 * * * *).
 *
 * Walks the OpenAI usage log, computes daily + monthly spend, persists a
 * snapshot row for the Admin Console /cost-monitor surface, and escalates
 * to ops via email on a status escalation (de-bounced — sustained over-cap
 * won't spam every tick).
 */
import { NextRequest, NextResponse } from 'next/server'
import { checkPlatformCostStatus, recordCostSnapshot } from '@/lib/cost-tracking'

function verifyCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const status = await checkPlatformCostStatus()
  await recordCostSnapshot(status)

  if (status.status === 'over_daily' || status.status === 'over_monthly') {
    console.error('[cost-monitor] CAP EXCEEDED', JSON.stringify(status))
  } else if (status.status === 'warn') {
    console.warn('[cost-monitor] approaching cap', JSON.stringify(status))
  }

  return NextResponse.json(status)
}
