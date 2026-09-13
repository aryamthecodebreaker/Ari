import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Settings } from '@ari/contracts/settings'
import { delegationSettingsSchema } from '@ari/contracts/agent-control'
import { ThemeProvider } from '@ari/ui/theme-provider'
import { AppearanceSettings } from './AppearanceSettings'

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  holder: { settings: null as Settings | null },
}))

vi.mock('./useEngineSettings', () => ({
  useEngineSettings: () => ({ settings: mocks.holder.settings, update: mocks.update }),
}))

const rpcMocks = vi.hoisted(() => ({ invoke: vi.fn(), subscribe: vi.fn(() => () => undefined) }))

vi.mock('../../lib/rpc', () => ({ rpc: rpcMocks }))

const engineSettings: Settings = {
  version: 1,
  delegation: delegationSettingsSchema.parse({}),
  appearance: {
    themeId: 'obsidian',
    mode: 'system',
    glass: true,
    reducedMotion: false,
    wallpaper: 'none',
    customWallpapers: [],
    wallpaperRotation: false,
    wallpaperRotationMinutes: 10,
    wallpaperClarity: 0,
  },
  sessions: { defaultDriverKind: null, defaultPermissionMode: 'ask' },
  notifications: { settleSound: true },
  permissions: { allowlist: [] },
  window: null,
}

function renderPage() {
  return render(
    <ThemeProvider>
      <AppearanceSettings />
    </ThemeProvider>,
  )
}

describe('AppearanceSettings', () => {
  beforeEach(() => {
    mocks.update.mockReset()
    mocks.update.mockResolvedValue(engineSettings)
    mocks.holder.settings = engineSettings
    localStorage.clear()
  })

  it('lists every theme grouped by scheme, plus follow-system', () => {
    renderPage()
    expect(screen.getByRole('radiogroup', { name: 'Dark' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Light' })).toBeInTheDocument()
    for (const label of ['Obsidian', 'Graphite', 'Nocturne', 'Verdant', 'Porcelain', 'Sandstone']) {
      expect(screen.getByRole('radio', { name: new RegExp(label) })).toBeInTheDocument()
    }
    const followSystem = screen.getByRole('radio', { name: /Follow system/ })
    expect(followSystem).toHaveAttribute('aria-checked', 'true')
  })

  it('selects a theme and swaps the html attributes', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: /Porcelain/ }))

    await waitFor(() => {
      expect(document.documentElement.dataset['ariTheme']).toBe('porcelain')
    })
    expect(document.documentElement.dataset['ariScheme']).toBe('light')
    expect(screen.getByRole('radio', { name: /Porcelain/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('offers the glass toggle only for glass-capable themes', async () => {
    renderPage()
    const user = userEvent.setup()

    await user.click(screen.getByRole('radio', { name: /Nocturne/ }))
    const glass = await screen.findByRole('switch', { name: 'Glass chrome' })
    expect(glass).toHaveAttribute('aria-checked', 'true')

    await user.click(glass)
    await waitFor(() => {
      expect(document.documentElement.dataset['ariGlass']).toBe('off')
    })

    // Graphite is opaque by design — no toggle at all.
    await user.click(screen.getByRole('radio', { name: /Graphite/ }))
    await waitFor(() => {
      expect(screen.queryByRole('switch', { name: 'Glass chrome' })).not.toBeInTheDocument()
    })
  })

  it('lists every bundled wallpaper and applies the selection to the html attribute', async () => {
    renderPage()
    expect(screen.getByRole('radiogroup', { name: 'Wallpaper' })).toBeInTheDocument()
    for (const label of ['None', 'Anime City', 'Moon Landscape', 'Moon Landscape II']) {
      // "Moon Landscape" is a strict prefix of "Moon Landscape II" — exclude it.
      const pattern = label === 'Moon Landscape' ? /Moon Landscape(?! II)/ : new RegExp(label)
      expect(screen.getByRole('radio', { name: pattern })).toBeInTheDocument()
    }

    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: /Anime City/ }))
    await waitFor(() => {
      expect(document.documentElement.dataset['ariWallpaper']).toBe('anime-city')
    })
    expect(screen.getByRole('radio', { name: /Anime City/ })).toHaveAttribute('aria-checked', 'true')

    await user.click(screen.getByRole('radio', { name: /^None/ }))
    await waitFor(() => {
      expect(document.documentElement.dataset['ariWallpaper']).toBeUndefined()
    })
  })

  it('offers no visibility control — one uniform glass look per wallpaper', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: /Anime City/ }))
    await waitFor(() => {
      expect(document.documentElement.dataset['ariWallpaper']).toBe('anime-city')
    })
    expect(screen.queryByRole('group', { name: 'Wallpaper visibility' })).not.toBeInTheDocument()
    expect(document.documentElement.dataset['ariWallpaperLook']).toBeUndefined()
  })

  it('reflects the engine-backed reduced-motion value and toggles via update', async () => {
    mocks.holder.settings = {
      ...engineSettings,
      appearance: {
        themeId: 'obsidian',
        mode: 'system',
        glass: true,
        reducedMotion: true,
        wallpaper: 'none',
        customWallpapers: [],
        wallpaperRotation: false,
        wallpaperRotationMinutes: 10,
        wallpaperClarity: 0,
      },
    }
    renderPage()
    const toggle = screen.getByRole('switch', { name: 'Reduce motion' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    const user = userEvent.setup()
    await user.click(toggle)
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({ appearance: { reducedMotion: false } }),
    )
  })
})

describe('AppearanceSettings custom backgrounds', () => {
  /** Engine settings carrying a picked-image library. */
  function withImages(images: string[], overrides: Partial<Settings['appearance']> = {}): Settings {
    return {
      ...engineSettings,
      appearance: {
        ...engineSettings.appearance,
        wallpaper: 'custom',
        customWallpapers: images,
        ...overrides,
      },
    }
  }

  beforeEach(() => {
    mocks.update.mockReset()
    mocks.update.mockResolvedValue(engineSettings)
    mocks.holder.settings = engineSettings
    rpcMocks.invoke.mockReset()
    localStorage.clear()
    document.documentElement.removeAttribute('style')
  })

  it('offers the user library as a wallpaper choice', () => {
    renderPage()
    expect(screen.getByRole('radio', { name: /My images/ })).toBeInTheDocument()
  })

  it('hides the picker until the user library is the selection', async () => {
    renderPage()
    expect(screen.queryByRole('button', { name: /Add images/ })).not.toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: /My images/ }))
    expect(await screen.findByRole('button', { name: /Add images/ })).toBeInTheDocument()
  })

  it('saves what the native picker returns and selects it', async () => {
    rpcMocks.invoke.mockResolvedValue({ paths: ['C:\\pics\\one.jpg', 'C:\\pics\\two.png'] })
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: /My images/ }))
    await user.click(await screen.findByRole('button', { name: /Add images/ }))

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        appearance: { customWallpapers: ['C:\\pics\\one.jpg', 'C:\\pics\\two.png'] },
      }),
    )
    expect(rpcMocks.invoke).toHaveBeenCalledWith('dialog.pickImages')
    await waitFor(() => {
      expect(document.documentElement.dataset['ariWallpaper']).toBe('custom')
    })
  })

  /**
   * Renders with a stored library and selects it. The panel follows the live
   * ThemeProvider selection, not the stored one — in the app the provider
   * hydrates that from the same settings, but a bare provider starts at 'none'.
   */
  async function renderLibrary(
    images: string[],
    overrides: Partial<Settings['appearance']> = {},
  ): Promise<void> {
    mocks.holder.settings = withImages(images, overrides)
    renderPage()
    await userEvent.setup().click(screen.getByRole('radio', { name: /My images/ }))
  }

  it('leaves the library alone when the picker is cancelled', async () => {
    rpcMocks.invoke.mockResolvedValue({ paths: [] })
    await renderLibrary(['C:\\pics\\one.jpg'])
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Add images/ }))

    await waitFor(() => expect(rpcMocks.invoke).toHaveBeenCalledWith('dialog.pickImages'))
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('lists picked images by filename and removes one', async () => {
    await renderLibrary(['C:\\pics\\one.jpg', 'C:\\pics\\two.png'])
    expect(await screen.findByText('one.jpg')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Remove one.jpg' }))
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        appearance: { customWallpapers: ['C:\\pics\\two.png'] },
      }),
    )
  })

  it('cannot rotate a library with nothing to rotate through', async () => {
    await renderLibrary(['C:\\pics\\one.jpg'])
    expect(await screen.findByRole('switch', { name: 'Change automatically' })).toBeDisabled()
  })

  it('rotates once there is a second image', async () => {
    await renderLibrary(['C:\\pics\\one.jpg', 'C:\\pics\\two.png'])
    const toggle = await screen.findByRole('switch', { name: 'Change automatically' })
    expect(toggle).not.toBeDisabled()

    await userEvent.setup().click(toggle)
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({ appearance: { wallpaperRotation: true } }),
    )
  })

  it('persists the rotation interval the user types', async () => {
    await renderLibrary(['C:\\pics\\one.jpg', 'C:\\pics\\two.png'], { wallpaperRotation: true })
    const minutes = await screen.findByRole('spinbutton', { name: 'Minutes between changes' })

    fireEvent.change(minutes, { target: { value: '25' } })

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        appearance: { wallpaperRotationMinutes: 25 },
      }),
    )
  })

  it('shows the clarity slider only when a wallpaper is up, and applies it live', async () => {
    renderPage()
    expect(screen.queryByRole('slider', { name: 'Background clarity' })).not.toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: /Anime City/ }))
    const slider = await screen.findByRole('slider', { name: 'Background clarity' })

    // A debounce sits between the drag and the store, but the paint must not
    // wait for it — the tint lands on <html> immediately.
    fireEvent.change(slider, { target: { value: '100' } })
    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--ari-wallpaper-tint')).toBe('6%')
    })
    await waitFor(
      () =>
        expect(mocks.update).toHaveBeenCalledWith({ appearance: { wallpaperClarity: 1 } }),
      { timeout: 2000 },
    )
  })
})
