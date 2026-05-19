import { supabaseAdmin } from './supabase'
import { sendCostAlertEmail } from './mailer'

const COST_PER_CREDIT_INR = Number(process.env.AI_COST_PER_CREDIT_INR ?? '1.5')
const DAILY_CAP_INR = Number(process.env.OPENAI_DAILY_CAP_INR ?? '5000')
const MONTHLY_CAP_INR = Number(process.env.OPENAI_MONTHLY_CAP_INR ?? '50000')

// Ops alert recipients (comma-separated). Falls back to a safe default
// if not configured so cap breaches are never silently swallowed.
const OPS_ALERT_EMAILS = (process.env.OPS_ALERT_EMAILS ?? 'imperialhealthcaresystems@gmail.com')
  .split(',').map(s => s.trim()).filter(Boolean)

// Toggle that the AI route handlers consult before issuing OpenAI calls.
// Set on cron when monthly cap is exceeded; cleared at the next month start.
export function aiKillSwitchActive(): boolean {
  return process.env.AI_KILL_SWITCH === 'true'
}

export type SpendWindow = {
  total_credits: number
  total_tokens: number
  estimated_cost_inr: number
}

export type CostStatus = {
  status: 'ok' | 'warn' | 'over_daily' | 'over_monthly'
  daily: { spend: number; cap: number; pct: number }
  monthly: { spend: number; cap: number; pct: number }
  by_provider_credits: Record<string, number>
  message: string | null
  checked_at: string
}

function startOfTodayIso() {
  return new Date(new Date().toISOString().split('T')[0] + 'T00:00:00Z').toISOString()
}

function startOfMonthIso() {
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

async function sumAiLogs(sinceIso: string): Promise<SpendWindow & { by_provider: Record<string, number> }> {
  const { data } = await supabaseAdmin
    .from('crm_ai_logs')
    .select('credits_used, total_tokens, provider')
    .gte('created_at', sinceIso)

  const result = { total_credits: 0, total_tokens: 0, estimated_cost_inr: 0, by_provider: {} as Record<string, number> }
  for (const row of data ?? []) {
    const credits = Number(row.credits_used ?? 0)
    const tokens = Number(row.total_tokens ?? 0)
    const provider = (row.provider as string | null) ?? 'unknown'
    result.total_credits += credits
    result.total_tokens += tokens
    result.by_provider[provider] = (result.by_provider[provider] ?? 0) + credits
  }
  result.estimated_cost_inr = result.total_credits * COST_PER_CREDIT_INR
  return result
}

export async function getPlatformAiSpendToday() {
  return sumAiLogs(startOfTodayIso())
}

export async function getPlatformAiSpendThisMonth() {
  return sumAiLogs(startOfMonthIso())
}

export async function checkPlatformCostStatus(): Promise<CostStatus> {
  const [today, month] = await Promise.all([
    getPlatformAiSpendToday(),
    getPlatformAiSpendThisMonth(),
  ])

  const dailyPct = DAILY_CAP_INR > 0 ? today.estimated_cost_inr / DAILY_CAP_INR : 0
  const monthlyPct = MONTHLY_CAP_INR > 0 ? month.estimated_cost_inr / MONTHLY_CAP_INR : 0

  let status: CostStatus['status'] = 'ok'
  let message: string | null = null

  if (monthlyPct >= 1) {
    status = 'over_monthly'
    message = `Monthly AI cost cap exceeded: ₹${month.estimated_cost_inr.toFixed(0)} of ₹${MONTHLY_CAP_INR}.`
  } else if (dailyPct >= 1) {
    status = 'over_daily'
    message = `Daily AI cost cap exceeded: ₹${today.estimated_cost_inr.toFixed(0)} of ₹${DAILY_CAP_INR}.`
  } else if (monthlyPct >= 0.8 || dailyPct >= 0.8) {
    status = 'warn'
    const worst = Math.max(monthlyPct, dailyPct)
    message = `AI cost approaching cap (${(worst * 100).toFixed(0)}%). Daily ₹${today.estimated_cost_inr.toFixed(0)}/₹${DAILY_CAP_INR}, monthly ₹${month.estimated_cost_inr.toFixed(0)}/₹${MONTHLY_CAP_INR}.`
  }

  return {
    status,
    daily: { spend: today.estimated_cost_inr, cap: DAILY_CAP_INR, pct: dailyPct },
    monthly: { spend: month.estimated_cost_inr, cap: MONTHLY_CAP_INR, pct: monthlyPct },
    by_provider_credits: today.by_provider,
    message,
    checked_at: new Date().toISOString(),
  }
}

/**
 * Persist a snapshot row for trend visibility + escalate to ops via email
 * if we just crossed a threshold. De-bounces: only alerts if the most
 * recent prior snapshot was a healthier status than this one, so a sustained
 * over-cap condition doesn't spam ops every cron tick.
 */
export async function recordCostSnapshot(status: CostStatus) {
  await supabaseAdmin.from('platform_cost_snapshots').insert({
    checked_at: status.checked_at,
    daily_spend_inr: status.daily.spend,
    daily_cap_inr: status.daily.cap,
    monthly_spend_inr: status.monthly.spend,
    monthly_cap_inr: status.monthly.cap,
    status: status.status,
    by_provider: status.by_provider_credits,
    message: status.message,
  })

  if (status.status === 'ok') return

  // Look at the snapshot just before this one to decide if we should alert.
  const { data: prior } = await supabaseAdmin
    .from('platform_cost_snapshots')
    .select('status')
    .lt('checked_at', status.checked_at)
    .order('checked_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const escalated =
    !prior ||
    prior.status === 'ok' ||
    (prior.status === 'warn' && (status.status === 'over_daily' || status.status === 'over_monthly')) ||
    (prior.status === 'over_daily' && status.status === 'over_monthly')

  if (!escalated) return

  try {
    await sendCostAlertEmail({
      to: OPS_ALERT_EMAILS,
      status: status.status,
      message: status.message ?? `Status: ${status.status}`,
      dailySpend: status.daily.spend,
      dailyCap: status.daily.cap,
      monthlySpend: status.monthly.spend,
      monthlyCap: status.monthly.cap,
      byProvider: status.by_provider_credits,
    })
  } catch (e) {
    console.error('[cost-tracking] alert email failed:', e)
  }
}
