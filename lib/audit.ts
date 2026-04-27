import { supabaseAdmin } from './supabase'

export interface AuditEntry {
  org_id: string
  actor_id: string
  action: string
  resource_type: string
  resource_id?: string
  meta?: Record<string, unknown>
}

/** Fire-and-forget: writes to audit_logs table. Never throws. */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      org_id: entry.org_id,
      actor_id: entry.actor_id,
      action: entry.action,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id ?? null,
      meta: entry.meta ?? null,
      created_at: new Date().toISOString(),
    })
  } catch {
    // intentionally silent — audit logging must never break primary operation
  }
}
