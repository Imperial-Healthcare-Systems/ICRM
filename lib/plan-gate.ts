export type PlanTier = 'starter' | 'growth' | 'pro' | 'enterprise'

export const PLAN_FEATURES: Record<PlanTier, string[]> = {
  starter: [
    'leads', 'contacts', 'accounts', 'deals', 'activities',
    'pipeline', 'notes', 'tags', 'basic_reports',
  ],
  growth: [
    'leads', 'contacts', 'accounts', 'deals', 'activities',
    'pipeline', 'notes', 'tags', 'basic_reports',
    'quotations', 'invoices', 'email_campaigns', 'whatsapp',
    'documents', 'support_tickets', 'advanced_reports',
    'ai_lead_scoring', 'ai_email_draft',
  ],
  pro: [
    'leads', 'contacts', 'accounts', 'deals', 'activities',
    'pipeline', 'notes', 'tags', 'basic_reports',
    'quotations', 'invoices', 'email_campaigns', 'whatsapp',
    'documents', 'support_tickets', 'advanced_reports',
    'ai_lead_scoring', 'ai_email_draft',
    'contracts', 'proposals', 'purchase_orders', 'vendor_management',
    'field_visits', 'loyalty_program', 'automation_workflows',
    'custom_reports', 'ai_document_analysis', 'ecosystem_sync',
  ],
  enterprise: [
    'leads', 'contacts', 'accounts', 'deals', 'activities',
    'pipeline', 'notes', 'tags', 'basic_reports',
    'quotations', 'invoices', 'email_campaigns', 'whatsapp',
    'documents', 'support_tickets', 'advanced_reports',
    'ai_lead_scoring', 'ai_email_draft',
    'contracts', 'proposals', 'purchase_orders', 'vendor_management',
    'field_visits', 'loyalty_program', 'automation_workflows',
    'custom_reports', 'ai_document_analysis', 'ecosystem_sync',
    'white_label', 'sla_management', 'multi_currency',
    'partner_portal', 'api_access', 'dedicated_support',
  ],
}

export function checkPlan(planTier: PlanTier | string, feature: string): boolean {
  const tier = planTier as PlanTier
  return PLAN_FEATURES[tier]?.includes(feature) ?? false
}
