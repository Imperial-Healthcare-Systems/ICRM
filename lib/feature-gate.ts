import { supabaseAdmin } from './supabase'

type FeatureCheckResult =
  | { allowed: true; creditsToCharge: number }
  | { allowed: false; reason: 'no_feature' | 'no_credits' | 'plan_gate'; message: string }

export async function checkFeature(
  orgId: string,
  featureKey: string,
  units = 1
): Promise<FeatureCheckResult> {
  const { data: feature } = await supabaseAdmin
    .from('feature_catalog')
    .select('credit_cost, is_active')
    .eq('feature_key', featureKey)
    .single()

  if (!feature || !feature.is_active) {
    return { allowed: false, reason: 'no_feature', message: 'This feature is not available.' }
  }

  const creditsToCharge = feature.credit_cost * units

  if (creditsToCharge === 0) return { allowed: true, creditsToCharge: 0 }

  const { data: orgCredits } = await supabaseAdmin
    .from('org_credits')
    .select('balance')
    .eq('org_id', orgId)
    .single()

  if (!orgCredits || orgCredits.balance < creditsToCharge) {
    return {
      allowed: false,
      reason: 'no_credits',
      message: `Insufficient Imperial Intelligence credits. Need ${creditsToCharge}, have ${orgCredits?.balance ?? 0}.`,
    }
  }

  const { data: orgFeature } = await supabaseAdmin
    .from('org_features')
    .select('enabled')
    .eq('org_id', orgId)
    .eq('feature_key', featureKey)
    .single()

  if (orgFeature && !orgFeature.enabled) {
    return { allowed: false, reason: 'plan_gate', message: 'This feature is not enabled on your current plan.' }
  }

  return { allowed: true, creditsToCharge }
}

export async function consumeCredits(
  orgId: string,
  featureKey: string,
  amount: number,
  refId: string,
  userId: string
): Promise<void> {
  await supabaseAdmin.rpc('consume_credits', {
    p_org_id: orgId,
    p_feature_key: featureKey,
    p_amount: amount,
    p_ref_id: refId,
    p_user_id: userId,
  })
}
