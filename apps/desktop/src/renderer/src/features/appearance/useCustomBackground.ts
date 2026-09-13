import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@ari/ui/theme-provider'
import type { Settings } from '@ari/contracts/settings'
import { createLogger } from '@ari/shared/logger'
import { rpc } from '../../lib/rpc'
import {
  CLARITY_VAR_NAMES,
  clampRotationIndex,
  clarityVars,
  nextRotationIndex,
  rotationIntervalMs,
} from './custom-background'

const log = createLogger('appearance:background')

/**
 * Fired by the settings screen after it persists a background change. The
 * watcher below runs app-wide (rotation has to keep going while the user is in
 * a session), so it needs a nudge to re-read settings it did not write itself.
 */
export const APPEARANCE_CHANGED_EVENT = 'ari:appearance-changed'

export function announceAppearanceChange(): void {
  window.dispatchEvent(new CustomEvent(APPEARANCE_CHANGED_EVENT))
}

type Appearance = Settings['appearance']

/** Data URLs already read this session, keyed by path; images rarely change. */
const imageCache = new Map<string, Promise<string | null>>()

function readImage(path: string): Promise<string | null> {
  const cached = imageCache.get(path)
  if (cached) return cached
  const pending = rpc
    .invoke('wallpaper.read', { path })
    .then((result) => result.dataUrl)
    .catch(() => null)
  imageCache.set(path, pending)
  return pending
}

/** Drops cached images that are no longer in the user's library. */
function pruneCache(paths: readonly string[]): void {
  const keep = new Set(paths)
  for (const path of imageCache.keys()) {
    if (!keep.has(path)) imageCache.delete(path)
  }
}

/**
 * Paints the user's own background and keeps the clarity variables in sync.
 *
 * Headless: mount once, high in the tree. The scene URL cannot come from the
 * ThemeProvider because only the main process can read a file off disk, so
 * this owns `--ari-wallpaper-image` whenever the selection is 'custom' (see
 * applyWallpaperAttr, which deliberately leaves it alone for that case).
 */
export function useCustomBackground(): void {
  const { wallpaper } = useTheme()
  const [appearance, setAppearance] = useState<Appearance | null>(null)
  const [index, setIndex] = useState(0)
  // Rotation advances off a timer, so the effect that schedules it must not
  // also depend on the index it sets â€” that would restart the clock every tick.
  const indexRef = useRef(0)
  indexRef.current = index

  useEffect(() => {
    let cancelled = false
    const load = (): void => {
      void rpc.invoke('settings.get').then(
        (settings) => {
          if (!cancelled) setAppearance(settings.appearance)
        },
        (error: unknown) => log.warn('settings.get failed; background unchanged', { error }),
      )
    }
    load()
    window.addEventListener(APPEARANCE_CHANGED_EVENT, load)
    return () => {
      cancelled = true
      window.removeEventListener(APPEARANCE_CHANGED_EVENT, load)
    }
  }, [])

  const images = appearance?.customWallpapers ?? []
  const rotating = (appearance?.wallpaperRotation ?? false) && images.length > 1
  const rotationMinutes = appearance?.wallpaperRotationMinutes ?? 10
  const clarity = appearance?.wallpaperClarity ?? 0
  // Joined, not the array: a fresh array identity on every settings read would
  // otherwise restart rotation and re-run the paint effect each time.
  const imageKey = JSON.stringify(images)

  useEffect(() => {
    pruneCache(images)
    setIndex((current) => clampRotationIndex(current, images.length))
    // `images` is covered by imageKey; the array identity itself is not stable.
  }, [imageKey])

  useEffect(() => {
    if (!rotating || wallpaper !== 'custom') return
    const timer = setInterval(() => {
      setIndex((current) => nextRotationIndex(current, images.length))
    }, rotationIntervalMs(rotationMinutes))
    return () => clearInterval(timer)
  }, [rotating, rotationMinutes, imageKey, wallpaper])

  // Clarity applies to bundled scenes too â€” it describes the glass over any
  // wallpaper â€” but means nothing with no wallpaper at all.
  useEffect(() => {
    const root = document.documentElement
    if (wallpaper === 'none') {
      for (const name of CLARITY_VAR_NAMES) root.style.removeProperty(name)
      return
    }
    for (const [name, value] of Object.entries(clarityVars(clarity))) {
      root.style.setProperty(name, value)
    }
  }, [clarity, wallpaper])

  useEffect(() => {
    const root = document.documentElement
    if (wallpaper !== 'custom') return
    const path = images[clampRotationIndex(index, images.length)]
    if (path === undefined) {
      // 'custom' with an empty library: no scene to paint, and the plate alone
      // over the theme background is the honest result.
      root.style.removeProperty('--ari-wallpaper-image')
      return
    }
    let cancelled = false
    void readImage(path).then((dataUrl) => {
      if (cancelled) return
      if (dataUrl === null) {
        root.style.removeProperty('--ari-wallpaper-image')
        return
      }
      root.style.setProperty('--ari-wallpaper-image', `url("${dataUrl}")`)
    })
    return () => {
      cancelled = true
    }
  }, [wallpaper, index, imageKey])
}
