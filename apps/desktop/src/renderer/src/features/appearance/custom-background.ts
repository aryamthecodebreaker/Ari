/**
 * Custom background math, kept out of the hook so it can be tested without a
 * DOM: how clear the scene reads, and which image rotation is due.
 */

/** The frosted end of the clarity range — exactly wallpaper.css's fallbacks. */
const OPAQUE = { tint: 72, overlay: 82, input: 85, blur: 28 }

/**
 * The clear end: the picture essentially as it is, with no blur and only a
 * trace of tint left to keep panes distinguishable from each other. Text over
 * a busy photo is genuinely harder to read up here, which is the point of the
 * setting — the user decides how far to push it, and the range below the top
 * end stays comfortable.
 */
const CLEAR = { tint: 6, overlay: 30, input: 38, blur: 0 }

/** CSS custom properties wallpaper.css reads, for a clarity in [0, 1]. */
export function clarityVars(clarity: number): Record<string, string> {
  const t = Math.min(1, Math.max(0, Number.isFinite(clarity) ? clarity : 0))
  const between = (from: number, to: number): number => from + (to - from) * t
  return {
    '--ari-wallpaper-tint': `${String(Math.round(between(OPAQUE.tint, CLEAR.tint)))}%`,
    '--ari-wallpaper-tint-overlay': `${String(Math.round(between(OPAQUE.overlay, CLEAR.overlay)))}%`,
    '--ari-wallpaper-tint-input': `${String(Math.round(between(OPAQUE.input, CLEAR.input)))}%`,
    '--ari-wallpaper-blur': `${String(Math.round(between(OPAQUE.blur, CLEAR.blur)))}px`,
  }
}

/** Every property `clarityVars` sets, for clearing them again. */
export const CLARITY_VAR_NAMES = Object.keys(clarityVars(0))

export const MS_PER_MINUTE = 60_000

/** Rotation period in ms; at least one minute however the setting is stored. */
export function rotationIntervalMs(minutes: number): number {
  const safe = Number.isFinite(minutes) ? Math.floor(minutes) : 1
  return Math.max(1, safe) * MS_PER_MINUTE
}

/**
 * Index of the image to show next. Wraps, and answers 0 for an empty library
 * so a caller that just lost its last image still has a defined index.
 */
export function nextRotationIndex(current: number, count: number): number {
  if (count <= 0) return 0
  return (current + 1) % count
}

/**
 * Keeps an index pointing at a real image after the library changes. Picking
 * images is not rotation, so the shown image should not jump when the user
 * adds one — only an index that fell off the end moves.
 */
export function clampRotationIndex(index: number, count: number): number {
  if (count <= 0) return 0
  if (!Number.isFinite(index) || index < 0) return 0
  return index >= count ? 0 : Math.floor(index)
}
