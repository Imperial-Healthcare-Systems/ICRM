'use client'

import { useEffect, useState } from 'react'
import { Loader2, Palette, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '@/components/PageHeader'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'

type Branding = {
  level: 'none' | 'logo' | 'full' | 'custom_domain'
  logo_url: string | null
  logo_dark_url: string | null
  favicon_url: string | null
  primary_color: string | null
  accent_color: string | null
  app_name_crm: string | null
  email_from_name: string | null
  email_from_addr: string | null
  hide_powered_by: boolean
  invoice_logo_url: string | null
  invoice_footer_text: string | null
}

const HEX = /^#[0-9a-fA-F]{6}$/

const LEVEL_LABELS: Record<Branding['level'], string> = {
  none: 'No branding (Imperial defaults)',
  logo: 'Logo only',
  full: 'Full white-label (logo + colors + app name)',
  custom_domain: 'Custom domain',
}

export default function BrandingSettings() {
  const [b, setB] = useState<Branding | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings/branding')
      .then(r => r.json())
      .then(d => { setB(normalize(d.data)); setLoading(false) })
      .catch(() => { toast.error('Could not load branding.'); setLoading(false) })
  }, [])

  function normalize(raw: Partial<Branding> | null | undefined): Branding {
    return {
      level: (raw?.level ?? 'none') as Branding['level'],
      logo_url: raw?.logo_url ?? null,
      logo_dark_url: raw?.logo_dark_url ?? null,
      favicon_url: raw?.favicon_url ?? null,
      primary_color: raw?.primary_color ?? null,
      accent_color: raw?.accent_color ?? null,
      app_name_crm: raw?.app_name_crm ?? null,
      email_from_name: raw?.email_from_name ?? null,
      email_from_addr: raw?.email_from_addr ?? null,
      hide_powered_by: Boolean(raw?.hide_powered_by),
      invoice_logo_url: raw?.invoice_logo_url ?? null,
      invoice_footer_text: raw?.invoice_footer_text ?? null,
    }
  }

  async function save() {
    if (!b) return
    if (b.primary_color && !HEX.test(b.primary_color)) {
      toast.error('Primary color must be #RRGGBB')
      return
    }
    if (b.accent_color && !HEX.test(b.accent_color)) {
      toast.error('Accent color must be #RRGGBB')
      return
    }

    setSaving(true)
    const res = await fetch('/api/settings/branding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(b),
    })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) {
      toast.error(d.error ?? 'Save failed.')
      return
    }
    setB(normalize(d.data))
    toast.success('Branding saved.')
  }

  const inputCls =
    'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 transition'

  return (
    <div className="p-8 mx-auto max-w-3xl space-y-6">
      <PageHeader
        kicker="Settings"
        title="Branding"
        subtitle="Customise your CRM with your own logo, colours, and app name"
        actions={
          b && (
            <Button onClick={save} disabled={saving} icon={saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          )
        }
      />

      {loading || !b ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className="space-y-6">
          <Section title="White-label level" subtitle="Determines what brand elements you can override.">
            <select
              className={inputCls}
              value={b.level}
              onChange={e => setB({ ...b, level: e.target.value as Branding['level'] })}
            >
              {(Object.keys(LEVEL_LABELS) as Branding['level'][]).map(k => (
                <option key={k} value={k}>{LEVEL_LABELS[k]}</option>
              ))}
            </select>
          </Section>

          <Section title="App name" subtitle="Shown in the sidebar and emails.">
            <input
              className={inputCls}
              placeholder="Imperial CRM"
              value={b.app_name_crm ?? ''}
              onChange={e => setB({ ...b, app_name_crm: e.target.value })}
            />
          </Section>

          <Section title="Logo URLs" subtitle="Public HTTPS URLs. Recommended: 240×60 SVG or PNG.">
            <div className="space-y-2">
              <input
                className={inputCls}
                placeholder="Light-mode logo URL"
                value={b.logo_url ?? ''}
                onChange={e => setB({ ...b, logo_url: e.target.value })}
              />
              <input
                className={inputCls}
                placeholder="Dark-mode logo URL (optional)"
                value={b.logo_dark_url ?? ''}
                onChange={e => setB({ ...b, logo_dark_url: e.target.value })}
              />
              <input
                className={inputCls}
                placeholder="Favicon URL (optional, 32×32 ico/png)"
                value={b.favicon_url ?? ''}
                onChange={e => setB({ ...b, favicon_url: e.target.value })}
              />
            </div>
          </Section>

          <Section title="Colours" subtitle="6-digit hex (e.g. #F47920). Applied to buttons, links, accents.">
            <div className="flex gap-3">
              <ColorInput
                label="Primary"
                value={b.primary_color}
                onChange={v => setB({ ...b, primary_color: v })}
              />
              <ColorInput
                label="Accent"
                value={b.accent_color}
                onChange={v => setB({ ...b, accent_color: v })}
              />
            </div>
          </Section>

          <Section title="Invoice branding" subtitle="Shown on generated PDFs and customer-facing invoice pages.">
            <div className="space-y-2">
              <input
                className={inputCls}
                placeholder="Invoice logo URL (overrides app logo on PDFs)"
                value={b.invoice_logo_url ?? ''}
                onChange={e => setB({ ...b, invoice_logo_url: e.target.value })}
              />
              <textarea
                className={inputCls}
                rows={2}
                placeholder="Footer text on every invoice (e.g. payment terms, tax disclaimer)"
                value={b.invoice_footer_text ?? ''}
                onChange={e => setB({ ...b, invoice_footer_text: e.target.value })}
              />
            </div>
          </Section>

          <Section title="Outbound email sender" subtitle="Custom From: address requires DNS verification (SPF/DKIM) — applied automatically once verified.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                className={inputCls}
                placeholder="From name (e.g. Acme Sales)"
                value={b.email_from_name ?? ''}
                onChange={e => setB({ ...b, email_from_name: e.target.value })}
              />
              <input
                className={inputCls}
                placeholder="From address (e.g. sales@acme.com)"
                value={b.email_from_addr ?? ''}
                onChange={e => setB({ ...b, email_from_addr: e.target.value })}
              />
            </div>
          </Section>

          <Section title="Imperial watermark" subtitle="The 'Powered by Imperial CRM' badge in the corner. Hideable on Full white-label and above.">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={b.hide_powered_by}
                onChange={e => setB({ ...b, hide_powered_by: e.target.checked })}
                disabled={b.level !== 'full' && b.level !== 'custom_domain'}
                className="w-4 h-4"
              />
              Hide "Powered by Imperial CRM" watermark
              {b.level !== 'full' && b.level !== 'custom_domain' && (
                <span className="text-xs text-slate-500">(requires Full white-label or higher)</span>
              )}
            </label>
          </Section>
        </div>
      )}
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="surface-premium p-5 space-y-3">
      <div>
        <p className="text-white font-semibold text-sm">{title}</p>
        {subtitle && <p className="text-slate-500 text-xs mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function ColorInput({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  const v = value ?? ''
  return (
    <div className="flex-1">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={HEX.test(v) ? v : '#F47920'}
          onChange={e => onChange(e.target.value)}
          className="w-10 h-10 rounded border border-white/10 bg-transparent cursor-pointer shrink-0"
        />
        <input
          type="text"
          placeholder="#F47920"
          value={v}
          onChange={e => onChange(e.target.value || null)}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#F47920]/60 transition"
        />
      </div>
    </div>
  )
}
