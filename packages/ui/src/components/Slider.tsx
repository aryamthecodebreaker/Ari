import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'

export interface SliderProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'type'> {
  /** Controlled value; provide together with onValueChange. */
  value?: number
  /** Initial value for uncontrolled usage. */
  defaultValue?: number
  min?: number
  max?: number
  step?: number
  /** Called with the next value as the user drags or keys through the track. */
  onValueChange?: (value: number) => void
}

/**
 * Range control on the native input, so keyboard, screen readers, and pointer
 * behavior come from the platform. Track and thumb take their color from the
 * accent token via `accent-color`.
 */
export function Slider({
  value,
  defaultValue = 0,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  className,
  ...rest
}: SliderProps) {
  const [internal, setInternal] = useState(defaultValue)
  const isControlled = value !== undefined
  const current = isControlled ? value : internal

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value)
    if (!isControlled) setInternal(next)
    onValueChange?.(next)
  }

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={current}
      onChange={handleChange}
      className={[
        'h-1.5 w-40 cursor-pointer appearance-none rounded-full bg-surface-3 accent-accent',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  )
}
