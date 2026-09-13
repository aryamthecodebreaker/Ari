import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultMcpServers, findCommand, fixmapServer } from './mcp-servers'
import type { DetectEnvironment } from '../types'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ari-mcp-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function env(overrides: Partial<DetectEnvironment> = {}): DetectEnvironment {
  return { platform: 'win32', pathEnv: '', homeDir: join(dir, 'home'), ...overrides }
}

describe('findCommand', () => {
  it('prefers the runnable .cmd over npm’s extensionless shim on win32', async () => {
    const bin = join(dir, 'npm')
    await mkdir(bin, { recursive: true })
    // npm writes both; the agent spawns this command, and the sh shim fails
    // with ENOENT inside a subprocess Ari never sees.
    await writeFile(join(bin, 'fixmap'), '')
    await writeFile(join(bin, 'fixmap.cmd'), '')
    expect(findCommand('fixmap', env({ pathEnv: bin }))).toBe(join(bin, 'fixmap.cmd'))
  })

  it('takes the bare name on posix', async () => {
    const bin = join(dir, 'bin')
    await mkdir(bin, { recursive: true })
    await writeFile(join(bin, 'fixmap'), '')
    expect(findCommand('fixmap', env({ platform: 'linux', pathEnv: bin }))).toBe(
      join(bin, 'fixmap'),
    )
  })

  it('answers null when the tool is not installed', () => {
    expect(findCommand('fixmap', env({ pathEnv: dir }))).toBeNull()
  })
})

describe('fixmapServer', () => {
  it('names the installed binary and its mcp subcommand', async () => {
    const bin = join(dir, 'npm')
    await mkdir(bin, { recursive: true })
    await writeFile(join(bin, 'fixmap.cmd'), '')
    expect(fixmapServer(env({ pathEnv: bin }))).toEqual({
      name: 'fixmap',
      command: join(bin, 'fixmap.cmd'),
      args: ['mcp'],
      env: [],
    })
  })

  it('offers nothing rather than a server that cannot start', () => {
    // Ari ships no FixMap and fetches none: not installed means not offered,
    // and the agent behaves exactly as it did before.
    expect(fixmapServer(env({ pathEnv: dir }))).toBeNull()
  })
})

describe('defaultMcpServers', () => {
  it('offers fixmap when it is installed and switched on', async () => {
    const bin = join(dir, 'npm')
    await mkdir(bin, { recursive: true })
    await writeFile(join(bin, 'fixmap.cmd'), '')
    expect(defaultMcpServers({ fixmap: true }, env({ pathEnv: bin })).map((s) => s.name)).toEqual([
      'fixmap',
    ])
  })

  it('offers nothing once the user switches it off', async () => {
    const bin = join(dir, 'npm')
    await mkdir(bin, { recursive: true })
    await writeFile(join(bin, 'fixmap.cmd'), '')
    expect(defaultMcpServers({ fixmap: false }, env({ pathEnv: bin }))).toEqual([])
  })
})
