import clsx from 'clsx'

type SkeletonProps = {
  variant?: 'text' | 'card' | 'row' | 'stat' | 'avatar' | 'circle' | 'detail'
  className?: string
  count?: number
  width?: string
  height?: string
}

export default function Skeleton({
  variant = 'text', className, count, width, height,
}: SkeletonProps) {
  const base = 'rounded-lg anim-shimmer'

  if (variant === 'avatar' || variant === 'circle') {
    return <div className={clsx(base, 'rounded-full', className)} style={{ width: width ?? '40px', height: height ?? '40px' }} />
  }

  if (variant === 'text') {
    if (count && count > 1) {
      return (
        <div className={clsx('space-y-2', className)}>
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className={clsx(base, 'h-3')} style={{ width: i === count - 1 ? '60%' : '100%' }} />
          ))}
        </div>
      )
    }
    return <div className={clsx(base, 'h-4', className)} style={{ width: width ?? '100%' }} />
  }

  if (variant === 'stat') {
    return (
      <div className={clsx('bg-[var(--surface)] border border-[var(--border-subtle)] rounded-xl p-4 shadow-[var(--shadow-sm)]', className)}>
        <div className={clsx(base, 'w-8 h-8 rounded-lg mb-2.5')} />
        <div className={clsx(base, 'h-6 w-16 mb-1.5')} />
        <div className={clsx(base, 'h-3 w-24')} />
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <div className={clsx('bg-[var(--surface)] border border-[var(--border-subtle)] rounded-xl p-5 shadow-[var(--shadow-sm)]', className)}>
        <div className="flex items-start gap-3 mb-4">
          <div className={clsx(base, 'w-9 h-9 rounded-full')} />
          <div className="flex-1 space-y-2">
            <div className={clsx(base, 'h-4 w-2/3')} />
            <div className={clsx(base, 'h-3 w-1/2')} />
          </div>
        </div>
        <div className={clsx(base, 'h-3 w-full mb-2')} />
        <div className={clsx(base, 'h-2 w-full')} />
      </div>
    )
  }

  if (variant === 'row') {
    return (
      <div className={clsx('flex items-center gap-3 px-4 py-3', className)}>
        <div className={clsx(base, 'w-8 h-8 rounded-full')} />
        <div className="flex-1 space-y-1.5">
          <div className={clsx(base, 'h-3 w-2/5')} />
          <div className={clsx(base, 'h-2.5 w-1/4')} />
        </div>
        <div className={clsx(base, 'h-3 w-16')} />
      </div>
    )
  }

  if (variant === 'detail') {
    return (
      <div className={clsx('grid grid-cols-1 lg:grid-cols-3 gap-6', className)}>
        <div className="lg:col-span-2 bg-[var(--surface)] border border-[var(--border-subtle)] rounded-2xl p-6 space-y-3 shadow-[var(--shadow-sm)]">
          <div className={clsx(base, 'h-5 w-1/3')} />
          <div className={clsx(base, 'h-3 w-full')} />
          <div className={clsx(base, 'h-3 w-5/6')} />
          <div className={clsx(base, 'h-32 w-full mt-4')} />
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-2xl p-5 space-y-3 shadow-[var(--shadow-sm)]">
          <div className={clsx(base, 'h-32 w-32 rounded-full mx-auto')} />
          <div className={clsx(base, 'h-3 w-2/3 mx-auto')} />
          <div className={clsx(base, 'h-12 w-full')} />
        </div>
      </div>
    )
  }

  return <div className={clsx(base, className)} style={{ width, height }} />
}
