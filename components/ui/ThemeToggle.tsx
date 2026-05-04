'use client'

import { Sun, Moon, Monitor } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useTheme } from '@/components/ThemeProvider'
import type { Theme } from '@/lib/theme'

const OPTIONS: { value: Theme; icon: React.ReactNode; label: string; preview: string }[] = [
  { value: 'light',  icon: <Sun     className="w-4 h-4" />, label: 'Light',  preview: '#FAFAF7' },
  { value: 'dark',   icon: <Moon    className="w-4 h-4" />, label: 'Dark',   preview: '#07111F' },
  { value: 'system', icon: <Monitor className="w-4 h-4" />, label: 'System', preview: 'linear-gradient(135deg, #FAFAF7 0%, #FAFAF7 50%, #07111F 50%, #07111F 100%)' },
]

/**
 * Segmented control with sliding orange pill indicator.
 * Use in Settings → Appearance section.
 */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const buttons = container.querySelectorAll<HTMLButtonElement>('button[data-theme-option]')
    const idx = OPTIONS.findIndex(o => o.value === theme)
    const btn = buttons[idx]
    if (btn) {
      setIndicatorStyle({ left: btn.offsetLeft, width: btn.offsetWidth })
    }
  }, [theme])

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="relative inline-flex bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl p-1 gap-0.5"
      >
        {/* Sliding indicator */}
        <div
          className="absolute top-1 bottom-1 rounded-lg bg-[var(--surface)] shadow-[var(--shadow-sm)] border border-[var(--border-subtle)]"
          style={{
            left: `${indicatorStyle.left}px`,
            width: `${indicatorStyle.width}px`,
            transition: 'left 200ms cubic-bezier(0.22, 1, 0.36, 1), width 200ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
        {OPTIONS.map(opt => {
          const isActive = theme === opt.value
          return (
            <button
              key={opt.value}
              data-theme-option
              onClick={() => setTheme(opt.value)}
              className={clsx(
                'relative z-10 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
                isActive ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
              )}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          )
        })}
      </div>

      {/* Swatches */}
      <div className="grid grid-cols-3 gap-2 max-w-md">
        {OPTIONS.map(opt => {
          const isActive = theme === opt.value
          return (
            <button
              key={`swatch-${opt.value}`}
              onClick={() => setTheme(opt.value)}
              className={clsx(
                'relative rounded-xl p-3 border transition-all text-left',
                isActive
                  ? 'border-[var(--accent)]/50 ring-2 ring-[var(--accent-ring)]'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]',
              )}
            >
              <div
                className="w-full h-16 rounded-lg mb-2 border border-[var(--border-subtle)]"
                style={{ background: opt.preview }}
              />
              <p className="text-[var(--text-primary)] text-xs font-semibold flex items-center gap-1.5">
                {opt.icon}
                {opt.label}
              </p>
              <p className="text-[var(--text-muted)] text-[10px] mt-0.5">
                {opt.value === 'light' && 'Warm off-white canvas'}
                {opt.value === 'dark' && 'Imperial deep navy'}
                {opt.value === 'system' && 'Match OS preference'}
              </p>
            </button>
          )
        })}
      </div>

      <p className="text-[var(--text-muted)] text-xs">
        Tip: cycle themes anywhere with <kbd className="px-1.5 py-0.5 bg-[var(--surface-sunken)] border border-[var(--border-default)] rounded text-[10px] font-mono text-[var(--text-secondary)]">⌘ Shift T</kbd>
        <span className="hidden md:inline"> (or <kbd className="px-1.5 py-0.5 bg-[var(--surface-sunken)] border border-[var(--border-default)] rounded text-[10px] font-mono text-[var(--text-secondary)]">Ctrl Shift T</kbd>)</span>.
        Sidebar stays dark in both modes.
      </p>
    </div>
  )
}
