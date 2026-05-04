'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { MapPin, Plus, Users, Globe2 } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import StatCard from '@/components/ui/StatCard'
import Skeleton from '@/components/ui/Skeleton'
import Button from '@/components/ui/Button'
import { AvatarStack } from '@/components/ui/Avatar'

type Territory = {
  id: string; name: string; description: string | null
  regions: string[]; member_ids: string[]; is_active: boolean
  manager_id: string | null
  crm_users: { id: string; full_name: string } | null
}

type User = { id: string; full_name: string }

export default function TerritoriesPage() {
  const [items, setItems] = useState<Territory[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [tRes, uRes] = await Promise.all([
        fetch('/api/territories').then(r => r.json()),
        fetch('/api/team').then(r => r.json()),
      ])
      setItems(tRes.data ?? [])
      setUsers(uRes.data ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const nameById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const u of users) map[u.id] = u.full_name
    return map
  }, [users])

  const summary = useMemo(() => {
    const totalMembers = new Set(items.flatMap(t => t.member_ids ?? [])).size
    const totalRegions = new Set(items.flatMap(t => t.regions ?? [])).size
    const active = items.filter(t => t.is_active).length
    return { count: items.length, active, totalMembers, totalRegions }
  }, [items])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        kicker="Performance"
        title="Territories"
        subtitle="Group reps by region, vertical or account list"
        actions={
          <Button href="/territories/new" icon={<Plus className="w-4 h-4" />}>
            New Territory
          </Button>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total territories" value={summary.count}        tone="orange"  icon={<MapPin className="w-[18px] h-[18px]" />} />
        <StatCard label="Active"             value={summary.active}       tone="emerald" icon={<MapPin className="w-[18px] h-[18px]" />} />
        <StatCard label="Reps assigned"      value={summary.totalMembers} tone="blue"    icon={<Users className="w-[18px] h-[18px]" />} />
        <StatCard label="Regions covered"    value={summary.totalRegions} tone="purple"  icon={<Globe2 className="w-[18px] h-[18px]" />} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map(i => <Skeleton key={i} variant="card" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="surface-premium">
          <EmptyState icon={<MapPin className="w-7 h-7" />} title="No territories yet"
            description="Group your team by region, vertical, or account list. Then assign quotas per territory."
            actionLabel="New Territory" actionHref="/territories/new" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((t, idx) => (
            <Link key={t.id} href={`/territories/${t.id}`}
              className="surface-premium hover-lift p-5 transition group anim-rise hover:border-[#F47920]/30"
              style={{ animationDelay: `${Math.min(idx * 30, 200)}ms` }}>
              <div className="flex items-start justify-between mb-3 gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-white font-bold text-base group-hover:text-[#F47920] transition truncate">{t.name}</h3>
                  {t.description && <p className="text-slate-400 text-xs mt-1 line-clamp-2">{t.description}</p>}
                </div>
                {!t.is_active && <span className="text-[10px] text-slate-500 italic shrink-0">Inactive</span>}
              </div>

              {t.regions && t.regions.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {t.regions.slice(0, 4).map(r => (
                    <span key={r} className="text-[10px] font-medium bg-white/[0.04] text-slate-300 px-2 py-0.5 rounded-full border border-white/[0.04]">{r}</span>
                  ))}
                  {t.regions.length > 4 && (
                    <span className="text-[10px] text-slate-500 px-2 py-0.5">+{t.regions.length - 4}</span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-white/[0.04] mt-auto">
                <div className="min-w-0 flex-1">
                  <p className="text-kicker text-slate-500 mb-0.5">Manager</p>
                  <p className="text-slate-200 text-xs font-medium truncate">{t.crm_users?.full_name ?? 'Unassigned'}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-kicker text-slate-500 mb-1">{(t.member_ids?.length ?? 0)} members</p>
                  {t.member_ids && t.member_ids.length > 0
                    ? <AvatarStack ids={t.member_ids} nameById={nameById} size="sm" />
                    : <span className="text-slate-600 text-[11px]">none</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
