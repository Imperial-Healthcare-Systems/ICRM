import Link from 'next/link'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
}

export default function EmptyState({ icon, title, description, actionLabel, actionHref, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-slate-500 mb-4">
        {icon}
      </div>
      <h3 className="text-white font-semibold text-base mb-1">{title}</h3>
      <p className="text-slate-400 text-sm max-w-xs">{description}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-5 bg-[#F47920] hover:bg-[#e06810] text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition"
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !actionHref && (
        <button
          onClick={onAction}
          className="mt-5 bg-[#F47920] hover:bg-[#e06810] text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
