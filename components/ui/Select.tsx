'use client'

import * as RSelect from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import clsx from 'clsx'
import { ReactNode } from 'react'

export type SelectOption = {
  value: string
  label: ReactNode
  disabled?: boolean
  /** Optional secondary label rendered to the right (e.g. probability %) */
  hint?: ReactNode
}

export type SelectProps = {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  /** Allow selecting an empty option (clears the field). Default: false */
  allowClear?: boolean
  clearLabel?: string
}

export default function Select({
  value, onValueChange, options, placeholder = 'Select…',
  disabled, className, id, allowClear: allowClearProp = false, clearLabel: clearLabelProp,
}: SelectProps) {
  const triggerCls = clsx(
    'w-full flex items-center justify-between gap-2 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5',
    'text-white text-sm placeholder-slate-500',
    'focus:outline-none focus:border-[#F47920]/60 focus:ring-1 focus:ring-[#F47920]/20',
    'data-[placeholder]:text-slate-500',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'transition',
    className,
  )

  // Radix forbids value="" on SelectItem (reserved for clearing). If the
  // caller passed an option with value === '', auto-promote it to the clear
  // slot so we never render an invalid <SelectItem>.
  const emptyOpt = options.find(o => o.value === '')
  const filteredOptions = options.filter(o => o.value !== '')
  const allowClear = allowClearProp || !!emptyOpt
  const clearLabel = clearLabelProp ?? (typeof emptyOpt?.label === 'string' ? emptyOpt.label : 'None')

  const SENTINEL_CLEAR = '__clear__'
  const handleChange = (v: string) => onValueChange(v === SENTINEL_CLEAR ? '' : v)
  const triggerValue = value || SENTINEL_CLEAR

  return (
    <RSelect.Root value={triggerValue} onValueChange={handleChange} disabled={disabled}>
      <RSelect.Trigger id={id} className={triggerCls} aria-label={placeholder}>
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon className="text-slate-400">
          <ChevronDown className="w-4 h-4" />
        </RSelect.Icon>
      </RSelect.Trigger>

      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={4}
          className={clsx(
            'z-50 min-w-[var(--radix-select-trigger-width)] max-h-[280px] overflow-hidden',
            'bg-[#0D1B2E] border border-white/10 rounded-lg shadow-2xl',
            'animate-in fade-in-0 zoom-in-95 data-[side=top]:slide-in-from-bottom-2 data-[side=bottom]:slide-in-from-top-2',
          )}
        >
          <RSelect.ScrollUpButton className="flex items-center justify-center h-6 bg-[#0D1B2E] text-slate-400 cursor-default">
            <ChevronUp className="w-4 h-4" />
          </RSelect.ScrollUpButton>

          <RSelect.Viewport className="p-1">
            {allowClear && (
              <SelectItem value={SENTINEL_CLEAR}>
                <span className="italic text-slate-400">{clearLabel}</span>
              </SelectItem>
            )}
            {filteredOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                <span className="flex-1">{opt.label}</span>
                {opt.hint && <span className="text-slate-500 text-xs ml-2">{opt.hint}</span>}
              </SelectItem>
            ))}
          </RSelect.Viewport>

          <RSelect.ScrollDownButton className="flex items-center justify-center h-6 bg-[#0D1B2E] text-slate-400 cursor-default">
            <ChevronDown className="w-4 h-4" />
          </RSelect.ScrollDownButton>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  )
}

function SelectItem({ value, disabled, children }: { value: string; disabled?: boolean; children: ReactNode }) {
  return (
    <RSelect.Item
      value={value}
      disabled={disabled}
      className={clsx(
        'flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white',
        'cursor-pointer select-none outline-none',
        'data-[highlighted]:bg-[#F47920]/15 data-[highlighted]:text-[#F47920]',
        'data-[state=checked]:bg-[#F47920]/10 data-[state=checked]:text-[#F47920] data-[state=checked]:font-semibold',
        'data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed data-[disabled]:hover:bg-transparent',
      )}
    >
      <RSelect.ItemIndicator className="absolute left-1">
        <Check className="w-3 h-3" />
      </RSelect.ItemIndicator>
      <RSelect.ItemText asChild>
        <span className="flex-1 flex items-center pl-4">{children}</span>
      </RSelect.ItemText>
    </RSelect.Item>
  )
}
