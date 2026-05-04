'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Package, Plus, Search } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'

type Product = {
  id: string; name: string; sku: string | null; unit_price: number
  currency: string; tax_pct: number; category: string | null; unit: string; is_active: boolean
}

const fmt = (n: number, c = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n)

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (showInactive) params.set('active', 'false')
      const res = await fetch(`/api/products?${params}`)
      const data = await res.json()
      setProducts(data.data ?? [])
    } finally { setLoading(false) }
  }, [search, showInactive])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  return (
    <div className="p-6 mx-auto max-w-7xl">
      <PageHeader
        kicker="Catalog"
        title="Products & Services"
        subtitle={`${products.length} items`}
        actions={<Button href="/products/new" icon={<Plus className="w-4 h-4" />}>New Product</Button>}
      />

      <div className="flex gap-3 mb-4 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#0D1B2E] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#F47920]/60 transition" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#F47920]" />
          <span className="text-slate-400 text-xs">Show inactive</span>
        </label>
      </div>

      <div className="surface-premium overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold">Product</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">SKU</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Category</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Unit</th>
              <th className="text-right px-4 py-3 font-semibold">Price</th>
              <th className="text-right px-4 py-3 font-semibold hidden xl:table-cell">Tax</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton variant="text" className="h-3" /></td></tr>
            )) : products.length === 0 ? (
              <tr><td colSpan={7}>
                <EmptyState icon={<Package className="w-7 h-7" />} title="No products yet"
                  description="Add products and services so you can pull them into invoices and quotations."
                  actionLabel="New Product" actionHref="/products/new" />
              </td></tr>
            ) : products.map((p, idx) => (
              <tr key={p.id} className="hover:bg-white/[0.02] group anim-rise" style={{ animationDelay: `${Math.min(idx * 15, 200)}ms` }}>
                <td className="px-4 py-3">
                  <Link href={`/products/${p.id}`} className="text-white font-medium group-hover:text-[#F47920] transition">{p.name}</Link>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs font-mono hidden md:table-cell tabular-nums">{p.sku ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">{p.category ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">{p.unit}</td>
                <td className="px-4 py-3 text-right text-[#F47920] font-bold tabular-nums">{fmt(p.unit_price, p.currency)}</td>
                <td className="px-4 py-3 text-right text-slate-400 text-xs hidden xl:table-cell tabular-nums">{p.tax_pct}%</td>
                <td className="px-4 py-3">
                  {!p.is_active && <span className="text-[10px] text-slate-500 italic">Inactive</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
