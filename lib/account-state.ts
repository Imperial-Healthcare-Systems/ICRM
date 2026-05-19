import type { SupabaseClient } from '@supabase/supabase-js'

export type AccountState =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'read_only'
  | 'export_only'
  | 'deactivated'
  | 'cancelled'

export type AccountCapabilities = {
  state: AccountState
  canRead: boolean
  canWrite: boolean
  canExport: boolean
  daysUntilTrialEnd: number | null
  daysSinceTrialEnd: number | null
  message: string | null
}

const CAPABILITIES: Record<AccountState, Pick<AccountCapabilities, 'canRead' | 'canWrite' | 'canExport'>> = {
  trial:       { canRead: true,  canWrite: true,  canExport: true  },
  active:      { canRead: true,  canWrite: true,  canExport: true  },
  past_due:    { canRead: true,  canWrite: true,  canExport: true  },
  read_only:   { canRead: true,  canWrite: false, canExport: true  },
  export_only: { canRead: true,  canWrite: false, canExport: true  },
  deactivated: { canRead: false, canWrite: false, canExport: false },
  cancelled:   { canRead: false, canWrite: false, canExport: false },
}

const MESSAGES: Record<AccountState, string | null> = {
  trial:       null,
  active:      null,
  past_due:    'Your subscription is past due. Please update payment to avoid restrictions.',
  read_only:   'Your account is read-only. Add a payment method to restore write access.',
  export_only: 'Your account is export-only. Your data is available to export for a limited time.',
  deactivated: 'Your account has been deactivated. Contact support to restore access.',
  cancelled:   'Your subscription has been cancelled. Contact support if this is unexpected.',
}

export function deriveCapabilities(sub: {
  status: string
  trial_ends_at: string | null
}): AccountCapabilities {
  const state = (sub.status as AccountState) in CAPABILITIES
    ? (sub.status as AccountState)
    : 'active'

  const caps = CAPABILITIES[state]
  const now = Date.now()
  const trialEnd = sub.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : null

  return {
    state,
    canRead: caps.canRead,
    canWrite: caps.canWrite,
    canExport: caps.canExport,
    daysUntilTrialEnd: trialEnd && trialEnd > now
      ? Math.ceil((trialEnd - now) / 86_400_000)
      : null,
    daysSinceTrialEnd: trialEnd && trialEnd <= now
      ? Math.floor((now - trialEnd) / 86_400_000)
      : null,
    message: MESSAGES[state],
  }
}

export async function getOrgAccountState(
  supabase: SupabaseClient,
  orgId: string,
): Promise<AccountCapabilities> {
  const { data } = await supabase
    .from('org_subscriptions')
    .select('status, trial_ends_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) {
    return {
      state: 'active',
      canRead: true,
      canWrite: true,
      canExport: true,
      daysUntilTrialEnd: null,
      daysSinceTrialEnd: null,
      message: null,
    }
  }

  return deriveCapabilities(data)
}
