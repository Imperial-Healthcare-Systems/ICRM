import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const startedAt = Date.now()

  let dbOk = false
  let dbLatencyMs: number | null = null
  try {
    const probeStart = Date.now()
    const { error } = await supabaseAdmin
      .from('organisations')
      .select('id', { count: 'exact', head: true })
      .limit(1)
    dbLatencyMs = Date.now() - probeStart
    dbOk = !error
  } catch {
    dbOk = false
  }

  const status = dbOk ? 'ok' : 'degraded'
  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      db: { ok: dbOk, latency_ms: dbLatencyMs },
      response_time_ms: Date.now() - startedAt,
    },
    { status: dbOk ? 200 : 503 },
  )
}
