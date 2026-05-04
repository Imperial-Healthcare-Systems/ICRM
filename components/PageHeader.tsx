'use client'

import Link from 'next/link'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { ReactNode } from 'react'
import clsx from 'clsx'

export type PageHeaderCrumb = { label: string; href?: string }

interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Small caps label rendered above the title — e.g. "Performance" on a Quotas page */
  kicker?: string
  /** Crumbs rendered above the title with separators. Last crumb is the current page. */
  breadcrumbs?: PageHeaderCrumb[]
  /** Renders a back arrow that navigates to this href */
  backHref?: string
  /** Right-aligned actions (typically a primary button) */
  actions?: ReactNode
  /** Optional renderer placed below the title row but above the hairline */
  meta?: ReactNode
  /** Hide the bottom hairline (when the page wants to attach hero content directly) */
  noDivider?: boolean
  className?: string
}

export default function PageHeader({
  title, subtitle, kicker, breadcrumbs, backHref, actions, meta, noDivider, className,
}: PageHeaderProps) {
  return (
    <div className={clsx('mb-6', className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-xs text-[var(--text-muted)] mb-3" aria-label="Breadcrumb">
          {breadcrumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {c.href ? (
                <Link href={c.href} className="hover:text-[var(--text-secondary)] transition">{c.label}</Link>
              ) : (
                <span className="text-[var(--text-tertiary)]">{c.label}</span>
              )}
              {i < breadcrumbs.length - 1 && <ChevronRight className="w-3 h-3 text-[var(--text-faint)]" />}
            </span>
          ))}
        </nav>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {backHref && (
            <Link
              href={backHref}
              aria-label="Back"
              className="w-9 h-9 rounded-lg bg-[var(--hover-overlay-light)] hover:bg-[var(--hover-overlay-medium)] active:bg-[var(--hover-overlay-strong)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition mt-0.5 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
          )}
          <div className="min-w-0">
            {kicker && (
              <p className="text-kicker text-[var(--accent)] mb-1.5">{kicker}</p>
            )}
            <h1 className="text-title-1 text-[var(--text-primary)] truncate">{title}</h1>
            {subtitle && <p className="text-[var(--text-tertiary)] text-sm mt-1.5">{subtitle}</p>}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>

      {meta && <div className="mt-4">{meta}</div>}

      {!noDivider && <div className="hairline mt-5" />}
    </div>
  )
}
