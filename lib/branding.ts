import { cache } from 'react'
import { supabaseAdmin } from './supabase'

export type WhitelabelLevel = 'none' | 'logo' | 'full' | 'custom_domain'

export type OrgBranding = {
  level: WhitelabelLevel
  logo_url: string | null
  logo_dark_url: string | null
  favicon_url: string | null
  primary_color: string | null
  accent_color: string | null
  app_name_crm: string | null
  app_name_hrms: string | null
  email_from_name: string | null
  email_from_addr: string | null
  email_dns_verified: boolean
  custom_domain_crm: string | null
  custom_domain_verified: boolean
  hide_powered_by: boolean
  invoice_logo_url: string | null
  invoice_footer_text: string | null
  pdf_template: string | null
}

const DEFAULT_BRANDING: OrgBranding = {
  level: 'none',
  logo_url: null,
  logo_dark_url: null,
  favicon_url: null,
  primary_color: null,
  accent_color: null,
  app_name_crm: null,
  app_name_hrms: null,
  email_from_name: null,
  email_from_addr: null,
  email_dns_verified: false,
  custom_domain_crm: null,
  custom_domain_verified: false,
  hide_powered_by: false,
  invoice_logo_url: null,
  invoice_footer_text: null,
  pdf_template: null,
}

export const getOrgBranding = cache(async (orgId: string): Promise<OrgBranding> => {
  const { data } = await supabaseAdmin
    .from('org_branding')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()

  if (!data) return DEFAULT_BRANDING
  return { ...DEFAULT_BRANDING, ...(data as Partial<OrgBranding>) }
})

export function effectiveAppName(b: OrgBranding, productDefault: string): string {
  if (b.level === 'none') return productDefault
  return b.app_name_crm?.trim() || productDefault
}

export function effectiveLogoUrl(b: OrgBranding): string | null {
  if (b.level === 'none') return null
  return b.logo_url
}

export function showWatermark(b: OrgBranding): boolean {
  if (b.hide_powered_by && (b.level === 'full' || b.level === 'custom_domain')) return false
  return true
}

export function brandingCssVars(b: OrgBranding): React.CSSProperties {
  const vars: Record<string, string> = {}
  if (b.level !== 'none') {
    if (b.primary_color && /^#[0-9a-fA-F]{6}$/.test(b.primary_color)) {
      vars['--brand-primary'] = b.primary_color
    }
    if (b.accent_color && /^#[0-9a-fA-F]{6}$/.test(b.accent_color)) {
      vars['--brand-accent'] = b.accent_color
    }
  }
  return vars as React.CSSProperties
}
