import { basename } from 'node:path'

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

import { type SessionRecord, updateState } from './state-store.js'

const IDLE_TIMEOUT_MS = 10000
const HEARTBEAT_INTERVAL_MS = 5000

export class StateTracker {
  private registered = false
  private heartbeatTimer: NodeJS.Timeout | null = null
  private idleTimer: NodeJS.Timeout | null = null
  private sessionId: string | undefined = undefined
  private cwd: string | undefined = undefined
  private projectName: string | undefined = undefined
  private model: string | undefined = undefined

  private get cwdOrCwd(): string {
    return this.cwd ?? process.cwd()
  }

  private get projectNameOrCwd(): string {
    return this.projectName ?? basename(process.cwd())
  }

  constructor(private readonly pi: ExtensionAPI) {}

  private updateSessionRecord(updates: Partial<SessionRecord>): void {
    if (!this.sessionId) return
    const now = Date.now()
    const id = this.sessionId

    void updateState((state) => {
      const existing = state.sessions[id]
      const stateChanged =
        updates.state !== undefined && updates.state !== existing?.state

      const record: SessionRecord = {
        pid: process.pid,
        cwd: this.cwdOrCwd,
        projectName: this.projectNameOrCwd,
        lastHeartbeatAt: now,
        startedAt: existing?.startedAt ?? now,
        state: updates.state ?? existing?.state ?? 'running',
        stateChangedAt: stateChanged ? now : (existing?.stateChangedAt ?? now),
        model: this.model ?? existing?.model,
        lastEvent: updates.lastEvent ?? existing?.lastEvent,
      }

      return {
        ...state,
        sessions: { ...state.sessions, [id]: record },
      }
    })
  }

  private removeSession(): void {
    if (!this.sessionId) return
    const id = this.sessionId

    void updateState((state) => {
      const sessions: Record<string, SessionRecord | undefined> = {}
      for (const [key, value] of Object.entries(state.sessions)) {
        if (key !== id) sessions[key] = value
      }
      return { ...state, sessions }
    })
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
  }

  private startIdleTimer(): void {
    this.clearIdleTimer()
    this.idleTimer = setTimeout(() => {
      this.clearIdleTimer()
      this.updateSessionRecord({
        state: 'idle',
        lastEvent: { type: 'idle', summary: 'idle', at: Date.now() },
      })
    }, IDLE_TIMEOUT_MS)
  }

  register(): void {
    if (this.registered) return
    this.registered = true

    this.pi.on('session_start', (_event, ctx) => {
      this.sessionId = ctx.sessionManager.getSessionId()
      this.cwd = ctx.cwd
      this.projectName = basename(ctx.cwd)
      this.model = ctx.model?.id

      this.updateSessionRecord({
        lastEvent: {
          type: 'session_start',
          summary: 'started',
          at: Date.now(),
        },
      })

      this.heartbeatTimer = setInterval(() => {
        if (!this.sessionId) return
        const id = this.sessionId

        void updateState((state) => {
          const existing = state.sessions[id]
          if (!existing) return state

          return {
            ...state,
            sessions: {
              ...state.sessions,
              [id]: {
                ...existing,
                lastHeartbeatAt: Date.now(),
              },
            },
          }
        })
      }, HEARTBEAT_INTERVAL_MS)
    })

    this.pi.on('turn_start', () => {
      this.clearIdleTimer()
      this.updateSessionRecord({
        state: 'running',
        lastEvent: { type: 'turn_start', summary: 'running', at: Date.now() },
      })
    })

    this.pi.on('agent_start', () => {
      this.clearIdleTimer()
      this.updateSessionRecord({
        state: 'running',
        lastEvent: { type: 'agent_start', summary: 'running', at: Date.now() },
      })
    })

    this.pi.on('agent_settled', () => {
      this.startIdleTimer()
    })

    this.pi.on('tool_call', (event) => {
      this.updateSessionRecord({
        state: 'running',
        lastEvent: {
          type: 'tool_call',
          summary: `tool:${event.toolName}`,
          at: Date.now(),
        },
      })
    })

    this.pi.on('session_shutdown', () => {
      this.stop()
      this.removeSession()
    })
  }

  stop(): void {
    this.clearIdleTimer()
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    this.registered = false
  }
}
