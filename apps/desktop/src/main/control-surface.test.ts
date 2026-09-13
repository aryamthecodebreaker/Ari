import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { SessionStore } from '@ari/engine/session-store'
import { DriverRegistry } from '@ari/providers/registry'
import type { AdapterSession } from '@ari/providers/driver'
import { Engine } from './engine'

/**
 * The control-surface preamble announces Ari's own CLI to an agent that may
 * drive it. It belongs at the start of a provider thread, not in front of
 * every message the user sends: an agent that sees it repeatedly cannot tell
 * it from text injected into the user's input, and has refused to act on it.
 */
it('announces the control surface once per provider thread, not every turn', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ari-control-'))
  const store = new SessionStore({ rootDir: join(dir, 'sessions') })
  const registry = new DriverRegistry()
  const seen: AdapterSession[] = []
  let settle!: () => void
  const settled = (): Promise<void> =>
    new Promise<void>((resolve) => {
      settle = resolve
    })
  registry.register({
    kind: 'claude',
    create: async (session) => {
      seen.push(session)
      return {
        start: () => ({
          async *[Symbol.asyncIterator]() {
            yield { type: 'done' as const }
          },
        }),
        interrupt: () => undefined,
        dispose: async () => undefined,
      }
    },
  })
  const engine = new Engine({
    store,
    registry,
    publish: (_id, event) => {
      if (event.type === 'turn.settled') settle()
    },
    resolveWorkspace: async () => dir,
    runtimeEnvironment: async () => ({ ARI_ENV: '1', ARI_CONTROL_TOKEN: 'secret' }),
    git: { captureCheckpoint: async () => ({ ok: true, value: null }) },
  })

  try {
    await store.append('root', {
      type: 'session.created',
      session: {
        id: 'root',
        projectId: 'p',
        title: 'root',
        driverKind: 'claude',
        modelId: null,
        permissionMode: 'ask',
        status: 'idle',
        createdAt: 1,
        updatedAt: 1,
      },
    })

    let done = settled()
    await engine.dispatch({ type: 'turn.start', sessionId: 'root', text: 'First', attachments: [] })
    await done
    expect(seen[0]?.prompt).toContain('ari --skill')
    expect(seen[0]?.prompt).toContain('First')

    // The provider reported a thread of its own, so the next turn resumes it
    // and the agent already holds the preamble in that transcript.
    await store.append('root', { type: 'session.ref.observed', ref: 'native-thread-1' })

    done = settled()
    await engine.dispatch({ type: 'turn.start', sessionId: 'root', text: 'Second', attachments: [] })
    await done
    expect(seen[1]?.prompt).toContain('Second')
    expect(seen[1]?.prompt).not.toContain('Ari control surface')
    expect(seen[1]?.prompt).not.toContain('ARI_CONTROL_TOKEN')
  } finally {
    await store.closeJournal('root')
    await rm(dir, { recursive: true, force: true, maxRetries: 3 })
  }
})
