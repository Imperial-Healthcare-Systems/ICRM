/**
 * Constants and types safe for client-side import.
 *
 * Separate from `lib/branding.ts` because that module pulls in
 * `supabaseAdmin` (server-only) for getOrgBranding. Client components
 * (the watermark, the future /settings/branding page) need the
 * constants and types but not the server functions — keeping them
 * split here avoids a 'server-only' violation at build time.
 *
 * Watermark text is locked per IMPERIAL_TENANT_SPEC v1.0 §17 — the
 * separator is U+00B7 (middle dot), single line, no icons.
 */

export type WhitelabelLevel = 'none' | 'logo' | 'full' | 'custom_domain'

export const WATERMARK_LINES = {
  ihrms: 'Powered by IHRMS (Imperial HRMS) · Made with care in India by Imperial Tech Innovations',
  icrm:  'Powered by ICRM (Imperial CRM) · Made with care in India by Imperial Tech Innovations',
} as const

export const LEGAL_SELLER_LINE =
  'Imperial Healthcare Systems Pvt Ltd | CIN: U62099HR2025PTC137921 | GSTIN: 06AAICI5025Q1Z6'
