/**
 * Custom background math, kept out of the hook so it can be tested without a
 * DOM: how clear the scene reads, and which image rotation is due.
 */

/** The frosted end of the clarity range — exactly wallpaper.css's fallbacks. */
const OPAQUE = { tint: 72, overlay: 82, input: 85, blur: 28 }

/**
 * The clear end. The window plate goes to a trace of tint and no blur at all,
 * so the picture reads as itself.
 *
 * Inputs and floating surfaces deliberately do not follow it down. The
 * composer, popovers and menus are things you aim at: they have to stay
 * findable against any picture, and they keep their own blur from glass.css,
 * so holding their tint high reads as a dark glossy plate resting on the
 * scene rather than a pane that dissolved into it.
 */
const CLEAR = { tint: 6, overlay: 64, input: 74, blur: 0 }

/**
 * Text halo at each end. The plate is what keeps text legible at clarity 0, so
 * there is nothing to add there; as the plate thins out, a halo in the theme's
 * own background color fades in behind the text. Background, not a fixed
 * black: that darkens text in light themes and lightens it in dark ones, which
 * is the direction legibility actually needs in each.
 *
 * The halo is mostly an *outline*, not a glow. A wide soft shadow spreads out
 * from the glyph and the edge goes mushy exactly where it needs to be sharp;
 * a one-pixel hard offset on each side reads as a crisp contour instead. The
 * small blur that remains only pads the contour so it does not look stencilled.
 */
const HALO = { opaque: 0, clear: 100 }
const HALO_OFFSET = { opaque: 0, clear: 1 }
const HALO_BLUR = { opaque: 0, clear: 3 }

/** CSS custom properties wallpaper.css reads, for a clarity in [0, 1]. */
export function clarityVars(clarity: number): Record<string, string> {
  const t = Math.min(1, Math.max(0, Number.isFinite(clarity) ? clarity : 0))
  const between = (from: number, to: number): number => from + (to - from) * t
  return {
    '--ari-wallpaper-tint': `${String(Math.round(between(OPAQUE.tint, CLEAR.tint)))}%`,
    '--ari-wallpaper-tint-overlay': `${String(Math.round(between(OPAQUE.overlay, CLEAR.overlay)))}%`,
    '--ari-wallpaper-tint-input': `${String(Math.round(between(OPAQUE.input, CLEAR.input)))}%`,
    '--ari-wallpaper-blur': `${String(Math.round(between(OPAQUE.blur, CLEAR.blur)))}px`,
    '--ari-wallpaper-halo': `${String(Math.round(between(HALO.opaque, HALO.clear)))}%`,
    '--ari-wallpaper-halo-offset': `${String(Math.round(between(HALO_OFFSET.opaque, HALO_OFFSET.clear)))}px`,
    '--ari-wallpaper-halo-blur': `${String(Math.round(between(HALO_BLUR.opaque, HALO_BLUR.clear)))}px`,
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
