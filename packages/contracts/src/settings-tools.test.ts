import { describe, expect, it } from 'vitest'
import { settingsSchema, settingsUpdateSchema } from './settings'

describe('agent tool settings', () => {
  it('offers fixmap by default', () => {
    // Default-on is safe: with FixMap not installed, nothing is offered.
    expect(settingsSchema.parse({ version: 1 }).tools.fixmap).toBe(true)
  })

  it('keeps a settings file written before the section existed readable', () => {
    const legacy = {
      version: 1,
      appearance: { themeId: 'obsidian', mode: 'system', glass: true, wallpaper: 'none' },
      permissions: { allowlist: ['git status'] },
    }
    const parsed = settingsSchema.parse(legacy)
    expect(parsed.tools.fixmap).toBe(true)
    expect(parsed.permissions.allowlist).toEqual(['git status'])
  })

  it('accepts the toggle as a patch and refuses a non-boolean', () => {
    expect(settingsUpdateSchema.parse({ tools: { fixmap: false } }).tools?.fixmap).toBe(false)
    expect(settingsUpdateSchema.safeParse({ tools: { fixmap: 'yes' } }).success).toBe(false)
  })
})
