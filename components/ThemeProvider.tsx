'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  applyTheme,
  DEFAULT_THEME,
  getResolvedTheme,
  readStoredTheme,
  writeStoredTheme,
  type ResolvedTheme,
  type Theme,
} from '@/lib/theme'

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
  cycleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Hydrate from DOM (set by the inline init script) so SSR matches client
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light')

  // Sync state with whatever the init script wrote
  useEffect(() => {
    const stored = readStoredTheme()
    const r = getResolvedTheme(stored)
    setThemeState(stored)
    setResolvedTheme(r)
    document.documentElement.setAttribute('data-theme', r)
  }, [])

  // Re-resolve when 'system' and OS preference changes
  useEffect(() => {
    if (theme !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const r = getResolvedTheme('system')
      setResolvedTheme(r)
      document.documentElement.setAttribute('data-theme', r)
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    writeStoredTheme(next)
    const r = applyTheme(next)
    setThemeState(next)
    setResolvedTheme(r)
  }, [])

  const cycleTheme = useCallback(() => {
    setThemeState(curr => {
      const order: Theme[] = ['light', 'dark', 'system']
      const idx = order.indexOf(curr)
      const next = order[(idx + 1) % order.length]
      writeStoredTheme(next)
      const r = applyTheme(next)
      setResolvedTheme(r)
      return next
    })
  }, [])

  // Keyboard shortcut: Cmd/Ctrl + Shift + T
  // (Switched from L because Win+L locks the screen on Windows.)
  useEffect(() => {
    function isEditable(el: Element | null): boolean {
      if (!el) return false
      const tag = el.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      if ((el as HTMLElement).isContentEditable) return true
      return false
    }
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey
      if (!(meta && e.shiftKey && (e.key === 'T' || e.key === 't'))) return
      if (isEditable(document.activeElement)) return
      e.preventDefault()
      cycleTheme()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cycleTheme])

  const value = useMemo<ThemeContextValue>(() => ({
    theme, resolvedTheme, setTheme, cycleTheme,
  }), [theme, resolvedTheme, setTheme, cycleTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    // Safe fallback during very early render or in tests — caller should be inside provider
    return {
      theme: DEFAULT_THEME,
      resolvedTheme: 'light',
      setTheme: () => {},
      cycleTheme: () => {},
    }
  }
  return ctx
}
