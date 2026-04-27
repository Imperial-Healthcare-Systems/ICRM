import { supabaseAdmin } from './supabase'

export type EcosystemEventType =
  | 'employee.onboarded'
  | 'employee.exited'
  | 'employee.updated'
  | 'leave.approved'
  | 'warning.issued'
  | 'appreciation.issued'
  | 'payroll.approved'
  | 'deal.won'

export interface EcosystemEvent {
  event_type: EcosystemEventType
  source: 'icrm'
  org_id: string
  payload: Record<string, unknown>
}

/** Fire-and-forget: emits event to shared ecosystem_events table. Never throws. */
export async function emitEvent(event: EcosystemEvent): Promise<void> {
  try {
    await supabaseAdmin.from('ecosystem_events').insert({
      event_type: event.event_type,
      source_platform: event.source,
      org_id: event.org_id,
      payload: event.payload,
      created_at: new Date().toISOString(),
      processed: false,
    })
  } catch {
    // intentionally silent — ecosystem sync must never break primary operation
  }
}
