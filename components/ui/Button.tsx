import clsx from 'clsx'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline'
type Size = 'xs' | 'sm' | 'md' | 'lg'

const VARIANT_MAP: Record<Variant, string> = {
  primary:
    'bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] text-white shadow-[var(--accent-shadow)]',
  secondary:
    'bg-[var(--surface-sunken)] hover:bg-[var(--hover-overlay-medium)] active:bg-[var(--hover-overlay-strong)] text-[var(--text-primary)] border border-[var(--border-default)]',
  ghost:
    'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-overlay-light)] active:bg-[var(--hover-overlay-medium)]',
  destructive:
    'bg-red-500/15 hover:bg-red-500/25 active:bg-red-500/30 text-red-400 hover:text-red-300',
  outline:
    'border border-[var(--accent)]/40 text-[var(--accent)] hover:bg-[var(--accent-soft)] active:bg-[var(--accent-soft-strong)]',
}

const SIZE_MAP: Record<Size, string> = {
  xs: 'h-7 text-xs px-2.5 gap-1 rounded-md',
  sm: 'h-8 text-xs px-3 gap-1.5 rounded-lg',
  md: 'h-9 text-sm px-4 gap-2 rounded-lg',
  lg: 'h-11 text-sm px-5 gap-2 rounded-xl',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  iconRight?: ReactNode
  loading?: boolean
  href?: string
  fullWidth?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    icon,
    iconRight,
    loading,
    href,
    fullWidth,
    className,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  const cls = clsx(
    'inline-flex items-center justify-center font-semibold transition-all duration-150',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
    'active:scale-[0.98]',
    VARIANT_MAP[variant],
    SIZE_MAP[size],
    fullWidth && 'w-full',
    className,
  )

  const content = (
    <>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
      {iconRight && !loading && iconRight}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={cls}>
        {content}
      </Link>
    )
  }

  return (
    <button ref={ref} className={cls} disabled={disabled || loading} {...rest}>
      {content}
    </button>
  )
})

export default Button
