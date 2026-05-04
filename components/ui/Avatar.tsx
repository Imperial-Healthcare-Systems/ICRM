import clsx from 'clsx'

type AvatarProps = {
  name?: string | null
  id?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** When true, uses brand saffron instead of deterministic colour */
  brand?: boolean
  /** Optional ring around the avatar (useful in stacks against a card surface) */
  ring?: boolean
  className?: string
  src?: string | null
  title?: string
}

const SIZE_MAP: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-7 h-7 text-[11px]',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
}

const PALETTE = [
  'bg-blue-500/20 text-blue-300',
  'bg-emerald-500/20 text-emerald-300',
  'bg-purple-500/20 text-purple-300',
  'bg-pink-500/20 text-pink-300',
  'bg-yellow-500/20 text-yellow-300',
  'bg-cyan-500/20 text-cyan-300',
  'bg-rose-500/20 text-rose-300',
  'bg-indigo-500/20 text-indigo-300',
]

function colourForId(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export default function Avatar({
  name, id, size = 'md', brand = false, ring = false, className, src, title,
}: AvatarProps) {
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?'
  const tone = brand
    ? 'bg-[var(--accent-soft-strong)] text-[var(--accent)]'
    : id ? colourForId(id) : 'bg-[var(--surface-sunken)] text-[var(--text-tertiary)]'

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? ''}
        title={title ?? name ?? undefined}
        className={clsx(
          SIZE_MAP[size],
          'rounded-full object-cover shrink-0',
          ring && 'ring-2 ring-[var(--surface)]',
          className,
        )}
      />
    )
  }

  return (
    <div
      title={title ?? name ?? undefined}
      className={clsx(
        SIZE_MAP[size],
        'rounded-full flex items-center justify-center font-bold shrink-0 select-none',
        tone,
        ring && 'ring-2 ring-[var(--surface)]',
        className,
      )}
    >
      {initial}
    </div>
  )
}

export function AvatarStack({
  ids,
  nameById,
  max = 4,
  size = 'sm',
}: {
  ids: string[]
  nameById?: Record<string, string>
  max?: number
  size?: AvatarProps['size']
}) {
  if (!ids?.length) return null
  const visible = ids.slice(0, max)
  const overflow = ids.length - visible.length
  return (
    <div className="flex -space-x-1.5">
      {visible.map(id => (
        <Avatar key={id} id={id} name={nameById?.[id] ?? '?'} size={size} ring />
      ))}
      {overflow > 0 && (
        <div
          className={clsx(
            SIZE_MAP[size ?? 'sm'],
            'rounded-full ring-2 ring-[var(--surface)] bg-[var(--surface-sunken)] text-[var(--text-tertiary)] flex items-center justify-center font-bold',
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
