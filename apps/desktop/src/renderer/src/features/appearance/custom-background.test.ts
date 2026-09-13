import { describe, expect, it } from 'vitest'
import {
  CLARITY_VAR_NAMES,
  MS_PER_MINUTE,
  clampRotationIndex,
  clarityVars,
  nextRotationIndex,
  rotationIntervalMs,
} from './custom-background'

/** Percentage/pixel number out of a `34%` / `6px` custom-property value. */
function amount(value: string): number {
  return Number(value.replace(/[^0-9.]/g, ''))
}

describe('clarityVars', () => {
  /** The plate properties, which thin out as clarity rises. */
  const PLATE_VARS = CLARITY_VAR_NAMES.filter((name) => !name.includes('halo'))

  it('leaves the original frosted look at clarity 0', () => {
    const vars = clarityVars(0)
    expect(vars['--ari-wallpaper-tint']).toBe('72%')
    expect(vars['--ari-wallpaper-tint-overlay']).toBe('82%')
    expect(vars['--ari-wallpaper-tint-input']).toBe('85%')
    // The same values wallpaper.css falls back to, so 0 is a no-op.
    expect(vars['--ari-wallpaper-blur']).toBe('28px')
    // The plate alone keeps text legible here, so no halo behind it.
    expect(vars['--ari-wallpaper-halo']).toBe('0%')
    expect(vars['--ari-wallpaper-halo-blur']).toBe('0px')
  })

  it('thins tint and blur as clarity rises', () => {
    const dim = clarityVars(0)
    const mid = clarityVars(0.5)
    const clear = clarityVars(1)
    for (const name of PLATE_VARS) {
      expect(amount(mid[name] ?? '')).toBeLessThan(amount(dim[name] ?? ''))
      expect(amount(clear[name] ?? '')).toBeLessThan(amount(mid[name] ?? ''))
    }
  })

  it('strengthens the text halo as the plate thins, to keep text readable', () => {
    // The halo runs opposite the plate: whatever legibility the tint and blur
    // stop providing, it has to take over.
    const dim = clarityVars(0)
    const mid = clarityVars(0.5)
    const clear = clarityVars(1)
    expect(amount(mid['--ari-wallpaper-halo'] ?? '')).toBeGreaterThan(
      amount(dim['--ari-wallpaper-halo'] ?? ''),
    )
    expect(amount(clear['--ari-wallpaper-halo'] ?? '')).toBeGreaterThan(
      amount(mid['--ari-wallpaper-halo'] ?? ''),
    )
    expect(amount(clear['--ari-wallpaper-halo-blur'] ?? '')).toBeGreaterThan(0)
  })

  it('shows the picture essentially bare at the clearest setting', () => {
    const clear = clarityVars(1)
    // No blur at all up here, and only a trace of tint — enough that panes
    // still read as panes, not enough to wash the picture out.
    expect(amount(clear['--ari-wallpaper-blur'] ?? '')).toBe(0)
    expect(amount(clear['--ari-wallpaper-tint'] ?? '')).toBeGreaterThan(0)
    expect(amount(clear['--ari-wallpaper-tint'] ?? '')).toBeLessThan(10)
  })

  it('clamps out-of-range and non-finite input instead of emitting junk CSS', () => {
    expect(clarityVars(5)).toEqual(clarityVars(1))
    expect(clarityVars(-2)).toEqual(clarityVars(0))
    expect(clarityVars(Number.NaN)).toEqual(clarityVars(0))
  })
})

describe('rotationIntervalMs', () => {
  it('converts minutes to milliseconds', () => {
    expect(rotationIntervalMs(10)).toBe(10 * MS_PER_MINUTE)
  })

  it('never schedules a timer below one minute', () => {
    // A zero here would spin the interval as fast as the event loop allows.
    expect(rotationIntervalMs(0)).toBe(MS_PER_MINUTE)
    expect(rotationIntervalMs(-5)).toBe(MS_PER_MINUTE)
    expect(rotationIntervalMs(Number.NaN)).toBe(MS_PER_MINUTE)
  })
})

describe('nextRotationIndex', () => {
  it('advances and wraps', () => {
    expect(nextRotationIndex(0, 3)).toBe(1)
    expect(nextRotationIndex(2, 3)).toBe(0)
  })

  it('answers 0 with no images rather than dividing by zero', () => {
    expect(nextRotationIndex(3, 0)).toBe(0)
  })
})

describe('clampRotationIndex', () => {
  it('leaves an index that still points at an image', () => {
    // Adding a picture must not move the one on screen.
    expect(clampRotationIndex(2, 5)).toBe(2)
  })

  it('resets an index that fell off the end', () => {
    expect(clampRotationIndex(4, 2)).toBe(0)
    expect(clampRotationIndex(0, 0)).toBe(0)
    expect(clampRotationIndex(-1, 3)).toBe(0)
  })
})
