import { realpathSync } from 'node:fs'
import { basename } from 'node:path'

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

import { Registrar } from '../shared/registrar.js'
import type { StateTracker } from '../state-tracker.js'
import type { SessionRecord, SessionState } from './state-store.js'
import { updateState } from './state-store.js'

export class SessionStore extends Registrar {
  private readonly stateTracker: StateTracker
  private sessionId: string | undefined = undefined
  private meta: { pid: number; cwd: string; projectName: string } | undefined =
    undefined

  constructor(pi: ExtensionAPI, stateTracker: StateTracker) {
    super(pi)
    this.stateTracker = stateTracker
  }

  private async saveSession(nextState: SessionState): Promise<void> {
    if (this.sessionId === undefined || this.meta === undefined) return

    const now = Date.now()
    const meta = this.meta
    const sessionId = this.sessionId
    const id = String(meta.pid)

    await updateState((state) => {
      const existing = state.sessions[id]
      const isRunning = nextState === 'running'

      const startRunningAt = isRunning ? now : undefined

      const record: SessionRecord = {
        pid: meta.pid,
        sessionId,
        cwd: meta.cwd,
        projectName: meta.projectName,
        startedAt: existing?.startedAt ?? now,
        state: nextState,
        startedRunningAt: startRunningAt,
      }

      return {
        ...state,
        sessions: { ...state.sessions, [id]: record },
      }
    })
  }

  protected override setup(): void {
    this.pi.on('session_start', (_event, ctx) => {
      let normalizedCwd = ctx.cwd
      try {
        normalizedCwd = realpathSync(ctx.cwd)
      } catch {
        // Use original path if realpathSync fails
      }
      const meta = {
        pid: process.pid,
        cwd: normalizedCwd,
        projectName: basename(normalizedCwd),
      }
      const sessionId = ctx.sessionManager.getSessionId()
      this.sessionId = sessionId
      this.meta = meta
      void this.saveSession('idle')
    })

    this.unsubscribes.push(
      this.stateTracker.events.on('running', async () => {
        await this.saveSession('running')
      }),
      this.stateTracker.events.on('idle', async () => {
        await this.saveSession('idle')
      }),
      this.stateTracker.events.on('tool', async ({ data }) => {
        await this.saveSession(`tool_call:${data}`)
      }),
      this.stateTracker.events.on('event', async ({ data }) => {
        await this.saveSession(`event:${data}`)
      }),
    )
  }
}
