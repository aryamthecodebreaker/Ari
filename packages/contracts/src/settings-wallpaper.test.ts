import { describe, expect, it } from 'vitest'
import {
  MAX_CUSTOM_WALLPAPERS,
  MAX_WALLPAPER_ROTATION_MINUTES,
  settingsSchema,
  settingsUpdateSchema,
  wallpaperSchema,
} from './settings'

/** Settings as they parse from a file that predates custom backgrounds. */
const legacy = {
  version: 1,
  appearance: { themeId: 'obsidian', mode: 'system', glass: true, wallpaper: 'anime-city' },
}

describe('custom background settings', () => {
  it('accepts the user-picked selection alongside the bundled scenes', () => {
    expect(wallpaperSchema.parse('custom')).toBe('custom')
    expect(wallpaperSchema.parse('none')).toBe('none')
    expect(wallpaperSchema.parse('anime-city')).toBe('anime-city')
    expect(wallpaperSchema.safeParse('not-a-wallpaper').success).toBe(false)
  })

  it('defaults an older settings file to no images and no rotation', () => {
    const parsed = settingsSchema.parse(legacy)
    expect(parsed.appearance.wallpaper).toBe('anime-city')
    expect(parsed.appearance.customWallpapers).toEqual([])
    expect(parsed.appearance.wallpaperRotation).toBe(false)
    expect(parsed.appearance.wallpaperRotationMinutes).toBe(10)
    // Clarity 0 is the pre-existing look, so an upgrade changes nothing.
    expect(parsed.appearance.wallpaperClarity).toBe(0)
  })

  it('gives each parse its own image list', () => {
    const first = settingsSchema.parse({ version: 1 })
    const second = settingsSchema.parse({ version: 1 })
    first.appearance.customWallpapers.push('C:\\pictures\\one.jpg')
    expect(second.appearance.customWallpapers).toEqual([])
  })

  it('refuses a library larger than the cap', () => {
    const paths = Array.from({ length: MAX_CUSTOM_WALLPAPERS + 1 }, (_, i) => `C:\\pic\\${i}.jpg`)
    expect(settingsUpdateSchema.safeParse({ appearance: { customWallpapers: paths } }).success).toBe(
      false,
    )
    expect(
      settingsUpdateSchema.safeParse({ appearance: { customWallpapers: paths.slice(1) } }).success,
    ).toBe(true)
  })

  it('bounds the rotation interval and clarity', () => {
    const bad = [
      { wallpaperRotationMinutes: 0 },
      { wallpaperRotationMinutes: MAX_WALLPAPER_ROTATION_MINUTES + 1 },
      { wallpaperRotationMinutes: 2.5 },
      { wallpaperClarity: -0.1 },
      { wallpaperClarity: 1.1 },
    ]
    for (const appearance of bad) {
      expect(settingsUpdateSchema.safeParse({ appearance }).success).toBe(false)
    }
    expect(
      settingsUpdateSchema.safeParse({ appearance: { wallpaperRotationMinutes: 1440 } }).success,
    ).toBe(true)
    expect(settingsUpdateSchema.safeParse({ appearance: { wallpaperClarity: 1 } }).success).toBe(
      true,
    )
  })
})
