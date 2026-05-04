import type { ResolvedTheme } from './theme'

export type ChartTheme = {
  grid: string
  axis: string
  tickText: string
  tooltipBg: string
  tooltipBorder: string
  tooltipText: string
}

const LIGHT: ChartTheme = {
  grid:           'rgba(15, 23, 42, 0.06)',
  axis:           'rgba(15, 23, 42, 0.10)',
  tickText:       '#6B7280',
  tooltipBg:      '#FFFFFF',
  tooltipBorder:  'rgba(15, 23, 42, 0.10)',
  tooltipText:    '#1F2937',
}

const DARK: ChartTheme = {
  grid:           'rgba(255, 255, 255, 0.05)',
  axis:           'rgba(255, 255, 255, 0.10)',
  tickText:       '#94A3B8',
  tooltipBg:      '#0D1B2E',
  tooltipBorder:  'rgba(255, 255, 255, 0.08)',
  tooltipText:    '#FFFFFF',
}

export function getChartTheme(resolved: ResolvedTheme): ChartTheme {
  return resolved === 'dark' ? DARK : LIGHT
}
