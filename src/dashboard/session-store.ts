import { realpathSync } from 'node:fs'
import { basename } from 'node:path'

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

import { Registrar } from '../shared/registrar.js'
import type { StateTracker } from '../state-tracker.js'
import type { SessionRecord } from './state-store.js'
import { updateState } from './state-store.js'

export interface SessionUpdate {
  state: 'running' | 'idle'
}

export class SessionStore extends Registrar {
  private readonly stateTracker: StateTracker
  private sessionId: string | undefined = undefined
  private meta: { pid: number; cwd: string; projectName: string } | undefined =
    undefined

  constructor(pi: ExtensionAPI, stateTracker: StateTracker) {
    super(pi)
    this.stateTracker = stateTracker
  }

  private async saveSession(updates: SessionUpdate): Promise<void> {
    if (this.sessionId === undefined || this.meta === undefined) return

    const now = Date.now()
    const meta = this.meta
    const sessionId = this.sessionId
    const id = String(meta.pid)

    await updateState((state) => {
      const existing = state.sessions[id]
      const stateChanged = updates.state !== existing?.state

      const record: SessionRecord = {
        pid: meta.pid,
        sessionId,
        cwd: meta.cwd,
        projectName: meta.projectName,
        startedAt: existing?.startedAt ?? now,
        state: updates.state,
        stateChangedAt: stateChanged ? now : existing.stateChangedAt,
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
      void this.saveSession({ state: 'idle' })
    })

    this.unsubscribes.push(
      this.stateTracker.events.on('running', () => {
        void this.saveSession({ state: 'running' })
      }),
      this.stateTracker.events.on('idle', () => {
        void this.saveSession({ state: 'idle' })
      }),
    )
  }
}
