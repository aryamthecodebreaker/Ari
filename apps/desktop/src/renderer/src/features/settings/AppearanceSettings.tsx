import { useEffect, useRef, useState } from 'react'
import { Check, ImagePlus, Images, Monitor, X } from 'lucide-react'
import { createLogger } from '@ari/shared/logger'
import { Slider } from '@ari/ui/slider'
import { Switch } from '@ari/ui/switch'
import { useTheme } from '@ari/ui/theme-provider'
import { themeList } from '@ari/ui/themes'
import type { Theme, ThemeId } from '@ari/ui/themes'
import { wallpapers } from '@ari/ui/wallpapers'
import type { Wallpaper } from '@ari/ui/wallpapers'
import {
  MAX_CUSTOM_WALLPAPERS,
  MAX_WALLPAPER_ROTATION_MINUTES,
  MIN_WALLPAPER_ROTATION_MINUTES,
} from '@ari/contracts/settings'
import type { WallpaperSetting } from '@ari/contracts/settings'
import { rpc } from '../../lib/rpc'
import { clarityVars } from '../appearance/custom-background'
import { announceAppearanceChange } from '../appearance/useCustomBackground'
import { SettingsPage } from './SettingsPage'
import { SettingsRow } from './SettingsRow'
import { useEngineSettings } from './useEngineSettings'

const log = createLogger('settings:appearance')

/** Dragging the slider must feel live, so the write is debounced behind it. */
const CLARITY_COMMIT_MS = 300

/**
 * Miniature window painted from the registry palette: a sidebar with one
 * active row, a transcript with an accent reply. Shows how the theme actually
 * reads instead of four abstract dots.
 */
function ThemePreview({ theme }: { theme: Theme }) {
  const { colors } = theme
  const line = (width: string, color: string) => (
    <span className="block h-0.5 rounded-full" style={{ width, background: color }} />
  )
  return (
    <span
      aria-hidden="true"
      className="flex h-14 w-24 shrink-0 overflow-hidden rounded border border-border"
      style={{ background: colors.bg, color: colors.fg }}
    >
      <span
        className="flex w-8 shrink-0 flex-col gap-1 p-1.5"
        style={{ background: colors['surface-0'], borderRight: `1px solid ${colors.border}` }}
      >
        {line('60%', colors['fg-subtle'])}
        <span className="mt-0.5 h-1.5 rounded-sm" style={{ background: colors['glass-active'] }} />
        {line('80%', colors['surface-3'])}
        {line('65%', colors['surface-3'])}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 p-1.5">
        {line('70%', colors['fg-muted'])}
        {line('45%', colors['fg-subtle'])}
        <span
          className="mt-auto h-2.5 w-4/5 self-end rounded-sm"
          style={{ background: colors['surface-1'], border: `1px solid ${colors.border}` }}
        />
        <span className="h-1 w-2/5 rounded-full" style={{ background: colors.accent }} />
      </span>
    </span>
  )
}

function ThemeCard({
  label,
  description,
  selected,
  chips,
  onSelect,
}: {
  label: string
  description: string
  selected: boolean
  chips: React.ReactNode
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring ${
        selected
          ? 'border-accent/60 bg-accent-subtle'
          : 'border-border bg-glass-input hover:border-border-strong hover:bg-glass-hover'
      }`}
    >
      {chips}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-fg">{label}</span>
        <span className="block text-xs leading-relaxed text-fg-muted">{description}</span>
      </span>
      {selected ? <Check size={14} className="shrink-0 text-accent" aria-hidden="true" /> : null}
    </button>
  )
}

function ThemeGroup({
  title,
  themes,
  selectedMode,
  onSelect,
}: {
  title: string
  themes: readonly Theme[]
  selectedMode: string
  onSelect: (id: ThemeId) => void
}) {
  return (
    <section className="mt-4" aria-label={title}>
      <h3 className="mb-2 text-2xs font-medium uppercase tracking-wide text-fg-subtle">{title}</h3>
      <div role="radiogroup" aria-label={title} className="grid gap-2 md:grid-cols-2">
        {themes.map((theme) => (
          <ThemeCard
            key={theme.id}
            label={theme.label}
            description={theme.description}
            selected={selectedMode === theme.id}
            chips={<ThemePreview theme={theme} />}
            onSelect={() => onSelect(theme.id)}
          />
        ))}
      </div>
    </section>
  )
}

/** 16:9 preview of a bundled scene; 'none' renders the plain theme backdrop. */
function WallpaperThumb({ wallpaper, theme }: { wallpaper: Wallpaper | null; theme: Theme }) {
  if (wallpaper) {
    return (
      <img
        src={wallpaper.src}
        alt=""
        aria-hidden="true"
        className="h-14 w-24 shrink-0 rounded border border-border object-cover"
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className="h-14 w-24 shrink-0 rounded border border-border"
      style={{ background: theme.colors.bg }}
    />
  )
}

function WallpaperGroup({
  theme,
  selected,
  customCount,
  onSelect,
}: {
  theme: Theme
  selected: string
  customCount: number
  onSelect: (wallpaper: WallpaperSetting) => void
}) {
  return (
    <section className="mt-4" aria-label="Wallpaper">
      <h3 className="mb-2 text-2xs font-medium uppercase tracking-wide text-fg-subtle">Wallpaper</h3>
      <div role="radiogroup" aria-label="Wallpaper" className="grid gap-2">
        <ThemeCard
          label="None"
          description="Solid theme background — the scene layers under every palette."
          selected={selected === 'none'}
          chips={<WallpaperThumb wallpaper={null} theme={theme} />}
          onSelect={() => onSelect('none')}
        />
        {wallpapers.map((wallpaper) => (
          <ThemeCard
            key={wallpaper.id}
            label={wallpaper.label}
            description={`${wallpaper.description} Softly scrimmed; text and theme stay in front.`}
            selected={selected === wallpaper.id}
            chips={<WallpaperThumb wallpaper={wallpaper} theme={theme} />}
            onSelect={() => onSelect(wallpaper.id)}
          />
        ))}
        <ThemeCard
          label="My images"
          description={
            customCount === 0
              ? 'Pictures from this computer. Add some below.'
              : `${String(customCount)} picture${customCount === 1 ? '' : 's'} from this computer.`
          }
          selected={selected === 'custom'}
          chips={
            <span
              aria-hidden="true"
              className="flex h-14 w-24 shrink-0 items-center justify-center rounded border border-border bg-surface-1"
            >
              <Images size={18} className="text-fg-subtle" />
            </span>
          }
          onSelect={() => onSelect('custom')}
        />
      </div>
    </section>
  )
}

/** Trailing path segment — the filename is what identifies a picture here. */
function fileNameOf(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] ?? path
}

/**
 * The user's own background library: which pictures, and whether Ari cycles
 * through them. Only rendered while "My images" is the selection, since none
 * of it has an effect otherwise.
 */
function CustomBackgroundPanel({
  images,
  rotation,
  rotationMinutes,
  onImagesChange,
  onRotationChange,
  onRotationMinutesChange,
}: {
  images: readonly string[]
  rotation: boolean
  rotationMinutes: number
  onImagesChange: (next: string[]) => void
  onRotationChange: (next: boolean) => void
  onRotationMinutesChange: (next: number) => void
}) {
  const full = images.length >= MAX_CUSTOM_WALLPAPERS

  const addImages = (): void => {
    void rpc.invoke('dialog.pickImages').then(
      ({ paths }) => {
        if (paths.length === 0) return // cancelled picker is a no-op
        const merged = [...images]
        for (const path of paths) {
          if (!merged.includes(path)) merged.push(path)
        }
        onImagesChange(merged.slice(0, MAX_CUSTOM_WALLPAPERS))
      },
      (error: unknown) => log.warn('image picker failed', { error }),
    )
  }

  return (
    <section className="mt-4" aria-label="My images">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-2xs font-medium uppercase tracking-wide text-fg-subtle">My images</h3>
        <button
          type="button"
          onClick={addImages}
          disabled={full}
          className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-glass-input px-2.5 text-xs text-fg-muted transition-colors hover:border-border-strong hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ImagePlus size={13} aria-hidden="true" />
          Add images…
        </button>
      </div>

      {images.length === 0 ? (
        <p className="mt-2 text-xs leading-relaxed text-fg-muted">
          No pictures yet. Add JPG, PNG, WebP, GIF, or AVIF files from this computer.
        </p>
      ) : (
        <ul className="mt-2 grid gap-1">
          {images.map((path) => (
            <li
              key={path}
              className="flex items-center gap-2 rounded-md border border-border bg-glass-input px-2.5 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate text-xs text-fg" title={path}>
                {fileNameOf(path)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${fileNameOf(path)}`}
                onClick={() => onImagesChange(images.filter((kept) => kept !== path))}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-fg-subtle transition-colors hover:bg-glass-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {full ? (
        <p className="mt-2 text-xs text-fg-muted">
          That is the limit of {MAX_CUSTOM_WALLPAPERS} pictures. Remove one to add another.
        </p>
      ) : null}

      <div className="mt-2">
        <SettingsRow
          label="Change automatically"
          hint={
            images.length > 1
              ? 'Cycle through your pictures while Ari is open.'
              : 'Add a second picture to cycle between them.'
          }
        >
          <Switch
            checked={rotation}
            onCheckedChange={onRotationChange}
            disabled={images.length < 2}
            aria-label="Change automatically"
          />
        </SettingsRow>
        {rotation ? (
          <SettingsRow label="Change every" hint="How long each picture stays up, in minutes.">
            <span className="flex items-center gap-2">
              <input
                type="number"
                min={MIN_WALLPAPER_ROTATION_MINUTES}
                max={MAX_WALLPAPER_ROTATION_MINUTES}
                value={rotationMinutes}
                aria-label="Minutes between changes"
                onChange={(event) => {
                  const next = Number(event.target.value)
                  if (!Number.isFinite(next)) return
                  onRotationMinutesChange(
                    Math.min(
                      MAX_WALLPAPER_ROTATION_MINUTES,
                      Math.max(MIN_WALLPAPER_ROTATION_MINUTES, Math.floor(next)),
                    ),
                  )
                }}
                className="h-7 w-20 rounded-md border border-border bg-glass-input px-2 text-xs text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
              />
              <span className="text-xs text-fg-muted">min</span>
            </span>
          </SettingsRow>
        ) : null}
      </div>
    </section>
  )
}

/**
 * Appearance settings: theme picker (Light/Dark groups plus "Follow system"),
 * the wallpaper picker including the user's own pictures, the glass opt-in for
 * glass-capable themes, and reduced motion. Theme and wallpaper selection live
 * in the ThemeProvider, which persists through the engine settings store; the
 * background library, rotation, clarity and reduced motion are written here.
 */
export function AppearanceSettings() {
  const { settings, update } = useEngineSettings()
  const { mode, setMode, theme, glassPreference, glassEnabled, setGlass, wallpaper, setWallpaper } =
    useTheme()
  const reducedMotion = settings?.appearance.reducedMotion ?? false
  const images = settings?.appearance.customWallpapers ?? []
  const rotation = settings?.appearance.wallpaperRotation ?? false
  const rotationMinutes = settings?.appearance.wallpaperRotationMinutes ?? 10
  const storedClarity = settings?.appearance.wallpaperClarity ?? 0

  // The slider tracks the pointer locally; the store catches up behind it.
  const [clarity, setClarity] = useState(storedClarity)
  const draggingRef = useRef(false)
  useEffect(() => {
    if (!draggingRef.current) setClarity(storedClarity)
  }, [storedClarity])

  const persist = (patch: Parameters<typeof update>[0]): void => {
    void update(patch).then(announceAppearanceChange, (error: unknown) => {
      log.warn('failed to persist appearance', { error })
    })
  }

  const handleReducedMotionChange = (checked: boolean) => {
    void update({ appearance: { reducedMotion: checked } }).catch((error: unknown) => {
      log.warn('failed to persist reduced motion', { error })
    })
  }

  const handleImagesChange = (next: string[]): void => {
    // The library write lands before the selection changes. Both reach
    // SettingsStore.update, which builds from its in-memory copy and writes
    // through a single temp file, so starting them together could let one
    // overwrite the other or fail the other's rename.
    void update({ appearance: { customWallpapers: next } }).then(
      () => {
        announceAppearanceChange()
        // Picking pictures is how a user asks for them, so the first add
        // selects them too; losing the last one falls back to the plain theme
        // rather than leaving "My images" selected with nothing to show.
        if (next.length > 0 && wallpaper !== 'custom') setWallpaper('custom')
        if (next.length === 0 && wallpaper === 'custom') setWallpaper('none')
      },
      (error: unknown) => log.warn('failed to persist appearance', { error }),
    )
  }

  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** A clarity the preview already shows but the store has not been told. */
  const pendingClarity = useRef<number | null>(null)
  // Leaving the page inside the debounce must still save the value: the
  // preview has already painted it, so a restart that quietly reverted it
  // would read as a setting that did not stick.
  useEffect(
    () => () => {
      if (commitTimer.current !== null) clearTimeout(commitTimer.current)
      const pending = pendingClarity.current
      if (pending === null) return
      void update({ appearance: { wallpaperClarity: pending } }).then(
        announceAppearanceChange,
        (error: unknown) => log.warn('failed to persist clarity on leave', { error }),
      )
    },
    [update],
  )

  const handleClarityChange = (value: number): void => {
    const next = Math.min(1, Math.max(0, value / 100))
    draggingRef.current = true
    pendingClarity.current = next
    setClarity(next)
    // Paint immediately: the watcher only re-reads on a persisted change, and
    // a slider that lags the pointer by a debounce feels broken.
    for (const [name, cssValue] of Object.entries(clarityVars(next))) {
      document.documentElement.style.setProperty(name, cssValue)
    }
    if (commitTimer.current !== null) clearTimeout(commitTimer.current)
    commitTimer.current = setTimeout(() => {
      draggingRef.current = false
      pendingClarity.current = null
      persist({ appearance: { wallpaperClarity: next } })
    }, CLARITY_COMMIT_MS)
  }

  const dark = themeList.filter((t) => t.scheme === 'dark')
  const light = themeList.filter((t) => t.scheme === 'light')

  return (
    <SettingsPage title="Appearance">
      <SettingsRow
        label="Theme"
        hint="Pick a palette, or follow the system light/dark preference."
      >
        <span className="text-xs text-fg-muted">{theme.label}</span>
      </SettingsRow>

      <div role="radiogroup" aria-label="Follow system">
        <ThemeCard
          label="Follow system"
          description="Matches your OS light and dark preference automatically."
          selected={mode === 'system'}
          chips={<Monitor size={14} className="shrink-0 text-fg-muted" aria-hidden="true" />}
          onSelect={() => setMode('system')}
        />
      </div>

      <ThemeGroup title="Dark" themes={dark} selectedMode={mode} onSelect={setMode} />
      <ThemeGroup title="Light" themes={light} selectedMode={mode} onSelect={setMode} />

      <WallpaperGroup
        theme={theme}
        selected={wallpaper}
        customCount={images.length}
        onSelect={setWallpaper}
      />

      {wallpaper === 'custom' ? (
        <CustomBackgroundPanel
          images={images}
          rotation={rotation}
          rotationMinutes={rotationMinutes}
          onImagesChange={handleImagesChange}
          onRotationChange={(next) => persist({ appearance: { wallpaperRotation: next } })}
          onRotationMinutesChange={(next) =>
            persist({ appearance: { wallpaperRotationMinutes: next } })
          }
        />
      ) : null}

      <div className="mt-4">
        {wallpaper === 'none' ? null : (
          <SettingsRow
            label="Background clarity"
            hint="How plainly the picture reads through the app. Right is clearer; the frosting never drops far enough to hurt the text."
          >
            <Slider
              value={Math.round(clarity * 100)}
              onValueChange={handleClarityChange}
              aria-label="Background clarity"
            />
          </SettingsRow>
        )}
        {theme.glass ? (
          <SettingsRow
            label="Glass chrome"
            hint={
              glassEnabled
                ? 'Translucent sidebar, titlebar, and overlays.'
                : 'Disabled by the system reduced-transparency setting.'
            }
          >
            <Switch
              checked={glassPreference}
              onCheckedChange={setGlass}
              aria-label="Glass chrome"
            />
          </SettingsRow>
        ) : null}
        <SettingsRow label="Reduce motion" hint="Minimize animations throughout the app.">
          <Switch
            checked={reducedMotion}
            onCheckedChange={handleReducedMotionChange}
            aria-label="Reduce motion"
          />
        </SettingsRow>
      </div>
    </SettingsPage>
  )
}
