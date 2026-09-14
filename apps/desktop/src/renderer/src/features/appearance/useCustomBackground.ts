import { useEffect, useState } from 'react'
import { useTheme } from '@ari/ui/theme-provider'
import type { Settings } from '@ari/contracts/settings'
import { createLogger } from '@ari/shared/logger'
import { rpc } from '../../lib/rpc'
import {
  CLARITY_VAR_NAMES,
  clampRotationIndex,
  clarityVars,
  nextRotationIndex,
  retainedPaths,
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

/**
 * Data URLs for the pictures rotation needs right now — the one on screen and
 * the one due next — and nothing else. A data URL costs about 4/3 of its file
 * in renderer memory, so caching every picture visited would grow with the
 * library: forty images at the reader's size limit is over a gigabyte held for
 * the whole session. See {@link retainedPaths} for what is kept.
 */
const imageCache = new Map<string, Promise<string | null>>()

function readImage(path: string): Promise<string | null> {
  const cached = imageCache.get(path)
  if (cached) return cached
  const pending = rpc
    .invoke('wallpaper.read', { path })
    .then((result) => result.dataUrl)
    .catch(() => null)
  imageCache.set(path, pending)
  // A failed read is not a fact about the file — it may have been mid-copy or
  // on a drive that was asleep — so it must not be remembered as one.
  void pending.then((dataUrl) => {
    if (dataUrl === null && imageCache.get(path) === pending) imageCache.delete(path)
  })
  return pending
}

/** Releases every cached picture outside `paths`. */
function retainOnly(paths: readonly string[]): void {
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
  // A value, not the array: every settings read hands back a fresh array, and
  // depending on its identity would restart rotation and repaint each time.
  const imageKey = JSON.stringify(images)

  useEffect(() => {
    setIndex((current) => clampRotationIndex(current, images.length))
    // `images` is covered by imageKey; the array identity itself is not stable.
  }, [imageKey])

  // The interval does not depend on `index`: the functional update advances it,
  // so the clock is not restarted by the very tick it produces.
  useEffect(() => {
    if (!rotating || wallpaper !== 'custom') return
    const timer = setInterval(() => {
      setIndex((current) => nextRotationIndex(current, images.length))
    }, rotationIntervalMs(rotationMinutes))
    return () => clearInterval(timer)
  }, [rotating, rotationMinutes, imageKey, wallpaper])

  // Clarity applies to bundled scenes too — it describes the glass over any
  // wallpaper — but means nothing with no wallpaper at all.
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
    if (wallpaper !== 'custom') {
      // Nothing of ours is on screen, so nothing of ours stays in memory.
      retainOnly([])
      return
    }
    const keep = retainedPaths(images, index, rotating)
    retainOnly(keep)
    const [path, upcoming] = keep
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
    // Decode the next picture ahead of its turn so the change lands at once
    // rather than on a blank frame; it is one of the two the cache may hold.
    if (upcoming !== undefined) void readImage(upcoming)
    return () => {
      cancelled = true
    }
  }, [wallpaper, index, imageKey, rotating])
}
