import Link from 'next/link'
import clsx from 'clsx'
import { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  /** Secondary action — rendered as a ghost button beside the primary */
  secondaryActionLabel?: string
  secondaryActionHref?: string
  onSecondaryAction?: () => void
  /** Compact treatment — for use inside small panels */
  compact?: boolean
  className?: string
}

export default function EmptyState({
  icon, title, description,
  actionLabel, actionHref, onAction,
  secondaryActionLabel, secondaryActionHref, onSecondaryAction,
  compact, className,
}: EmptyStateProps) {
  return (
    <div className={clsx(
      'flex flex-col items-center justify-center text-center anim-fade-in',
      compact ? 'py-12' : 'py-20',
      className,
    )}>
      {/* Icon stack — radial halo + inset disk */}
      <div className="relative mb-5">
        <div className="absolute inset-0 -m-3 rounded-full bg-[var(--accent-soft)] blur-xl" />
        <div className={clsx(
          'relative rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)]',
          'flex items-center justify-center text-[var(--text-tertiary)]',
          compact ? 'w-12 h-12' : 'w-16 h-16',
        )}>
          {icon}
        </div>
      </div>

      <h3 className={clsx(
        'text-[var(--text-primary)] font-semibold mb-1.5',
        compact ? 'text-sm' : 'text-base',
      )}>{title}</h3>
      <p className={clsx(
        'text-[var(--text-tertiary)] max-w-sm leading-relaxed',
        compact ? 'text-xs' : 'text-sm',
      )}>{description}</p>

      {(actionLabel || secondaryActionLabel) && (
        <div className="flex items-center gap-2 mt-6">
          {actionLabel && actionHref && (
            <Link
              href={actionHref}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition shadow-[var(--accent-shadow)]"
            >
              {actionLabel}
            </Link>
          )}
          {actionLabel && onAction && !actionHref && (
            <button
              onClick={onAction}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition shadow-[var(--accent-shadow)]"
            >
              {actionLabel}
            </button>
          )}
          {secondaryActionLabel && secondaryActionHref && (
            <Link
              href={secondaryActionHref}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm px-4 py-2.5 rounded-lg bg-[var(--hover-overlay-light)] hover:bg-[var(--hover-overlay-medium)] transition font-medium"
            >
              {secondaryActionLabel}
            </Link>
          )}
          {secondaryActionLabel && onSecondaryAction && !secondaryActionHref && (
            <button
              onClick={onSecondaryAction}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm px-4 py-2.5 rounded-lg bg-[var(--hover-overlay-light)] hover:bg-[var(--hover-overlay-medium)] transition font-medium"
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
