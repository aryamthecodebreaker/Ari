import { existsSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { wellKnownDirs } from '../detector'
import { realDetectEnvironment } from '../types'
import type { DetectEnvironment } from '../types'

/**
 * MCP servers Ari offers its agents (ACP `session/new`, `session/load`,
 * `session/resume`).
 *
 * Ari ships none of these itself: it names a command the user already has
 * installed, exactly as it does for the agent CLIs. Nothing is downloaded, and
 * a tool that is not installed is simply not offered — the agent then behaves
 * as it did before, rather than failing on a server that cannot start.
 */

/** One stdio MCP server, shaped as the ACP schema sends it. */
export interface AcpMcpServer {
  name: string
  command: string
  args: string[]
  env: { name: string; value: string }[]
}

/**
 * Resolves an executable across PATH plus the platform's usual install dirs.
 *
 * Extension order matters on Windows and is not cosmetic: npm drops an
 * extensionless sh shim beside the `.cmd`, and the *agent* is what spawns this
 * command — handing it the sh shim fails with ENOENT inside a subprocess Ari
 * never sees.
 */
export function findCommand(name: string, env: DetectEnvironment): string | null {
  const names = env.platform === 'win32' ? [`${name}.cmd`, `${name}.exe`, name] : [name]
  const dirs = [
    ...env.pathEnv.split(delimiter).filter((entry) => entry.length > 0),
    ...wellKnownDirs(env),
  ]
  for (const dir of dirs) {
    for (const candidate of names) {
      const full = join(dir, candidate)
      if (existsSync(full)) return full
    }
  }
  return null
}

/**
 * FixMap (https://usefixmap.vercel.app) as an MCP server: a local, deterministic
 * repo map that tells an agent which files and tests to open first. It runs no
 * model and needs no account, so offering it costs a subprocess and nothing
 * else. Null when the user has not installed it.
 */
export function fixmapServer(env: DetectEnvironment = realDetectEnvironment()): AcpMcpServer | null {
  const command = findCommand('fixmap', env)
  if (command === null) return null
  return { name: 'fixmap', command, args: ['mcp'], env: [] }
}

/** What each ACP session is offered, given the user's tool settings. */
export function defaultMcpServers(
  options: { fixmap: boolean },
  env: DetectEnvironment = realDetectEnvironment(),
): AcpMcpServer[] {
  const servers: AcpMcpServer[] = []
  if (options.fixmap) {
    const fixmap = fixmapServer(env)
    if (fixmap) servers.push(fixmap)
  }
  return servers
}
