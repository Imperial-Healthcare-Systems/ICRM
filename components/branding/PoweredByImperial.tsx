'use client'

/**
 * Watermark component — IMPERIAL_TENANT_SPEC v1.0 §9.1.
 *
 * Renders the "Powered by ICRM (Imperial CRM) · Made with care in India
 * by Imperial Tech Innovations" line.
 *
 * Visibility comes from the session JWT's `activeBrandingLevel`. The
 * `hide_powered_by` flag is server-only and gets injected via the `hide`
 * prop from server components after they've fetched org_branding. The
 * JWT doesn't carry hide_powered_by because branding settings change
 * too rarely to be worth widening the token.
 *
 * Behaviour:
 *   - Default (no props): shows unless activeBrandingLevel is 'full' or
 *     'custom_domain' (conservative client-only hint). The server-rendered
 *     footer in (dashboard)/layout.tsx passes the precise `hide` value.
 *   - `hide={true}`: always hidden.
 *   - `forceShow={true}`: always shown (used on auth pages where the
 *     user has no session yet and the spec mandates a visible watermark).
 */
import { useSession } from 'next-auth/react'
import { WATERMARK_LINES } from '@/lib/branding-constants'

type Props = {
  context?: 'footer' | 'auth' | 'pdf' | 'email'
  /** Server-resolved decision; takes precedence over the client check. */
  hide?: boolean
  /** Force visibility (auth pages, marketing site, public portal). */
  forceShow?: boolean
  className?: string
  style?: React.CSSProperties
}

export default function PoweredByImperial({ hide, forceShow, className, style }: Props) {
  const { data: session } = useSession()

  if (!forceShow) {
    if (hide) return null
    const level = (session?.user as { activeBrandingLevel?: string } | undefined)?.activeBrandingLevel
    // Conservative client hint — final say belongs to the server-rendered
    // footer in (dashboard)/layout.tsx which knows hide_powered_by precisely.
    if (level === 'full' || level === 'custom_domain') return null
  }

  return (
    <div
      className={className}
      style={{
        textAlign: 'center',
        fontSize: 11,
        color: '#94A3B8',
        opacity: 0.8,
        letterSpacing: '-0.1px',
        padding: '8px 12px',
        ...style,
      }}
    >
      {WATERMARK_LINES.icrm}
    </div>
  )
}
