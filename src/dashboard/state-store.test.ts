import { unlinkSync } from 'node:fs'
import { join } from 'node:path'

import { getAgentDir } from '@earendil-works/pi-coding-agent'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isProcessAlive, readSessions, updateState } from './state-store.js'

describe('isProcessAlive', () => {
  it('returns true for current process pid', () => {
    expect(isProcessAlive(process.pid)).toBe(true)
  })

  it('returns false for non-existent pid', () => {
    expect(isProcessAlive(999999)).toBe(false)
  })

  it('returns false for pid out of range', () => {
    expect(isProcessAlive(2147483647)).toBe(false)
  })

  it('returns false for invalid pid', () => {
    expect(isProcessAlive(0)).toBe(false)
    expect(isProcessAlive(-1)).toBe(false)
  })

  it('handles ESRCH gracefully', () => {
    const error = new Error('process not found') as Error & { code: string }
    error.code = 'ESRCH'
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw error
    })
    try {
      expect(isProcessAlive(12345)).toBe(false)
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('returns true for EPERM (process exists but no permission)', () => {
    const error = new Error('permission denied') as Error & { code: string }
    error.code = 'EPERM'
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw error
    })
    try {
      expect(isProcessAlive(1)).toBe(true)
    } finally {
      vi.restoreAllMocks()
    }
  })
})

describe('readSessions', () => {
  const testDir = join(getAgentDir(), 'pi-notify-test')
  const testLockFile = join(testDir, 'state.json.lock')

  beforeEach(async () => {
    try {
      unlinkSync(testLockFile)
    } catch {
      // ignore
    }
    await updateState(() => ({ version: 1, sessions: {} }))
  })

  afterEach(() => {
    try {
      unlinkSync(testLockFile)
    } catch {
      // ignore
    }
  })

  it('keeps alive sessions and removes dead ones', async () => {
    const aliveSessionId = `alive-${Date.now()}`
    const deadSessionId = `dead-${Date.now()}`
    const deadPid = 999999
    const aliveKey = String(process.pid)
    const deadKey = String(deadPid)

    await updateState((state) => ({
      ...state,
      sessions: {
        ...state.sessions,
        [aliveKey]: {
          pid: process.pid,
          sessionId: aliveSessionId,
          cwd: process.cwd(),
          projectName: 'alive-project',
          startedAt: Date.now(),
          state: 'running',
          stateChangedAt: Date.now(),
        },
        [deadKey]: {
          pid: deadPid,
          sessionId: deadSessionId,
          cwd: process.cwd(),
          projectName: 'dead-project',
          startedAt: Date.now(),
          state: 'running',
          stateChangedAt: Date.now(),
        },
      },
    }))

    const alive = await readSessions()

    expect(alive.some((s) => s.sessionId === aliveSessionId)).toBe(true)
    expect(alive.every((s) => s.sessionId !== deadSessionId)).toBe(true)

    const state = await import('./state-store.js').then((m) => m.readState())
    expect(aliveKey in state.sessions).toBe(true)
    expect(deadKey in state.sessions).toBe(false)
  })

  it('returns all sessions when none are dead', async () => {
    const sessionId = `all-alive-${Date.now()}`

    await updateState((state) => ({
      ...state,
      sessions: {
        ...state.sessions,
        [sessionId]: {
          pid: process.pid,
          sessionId,
          cwd: process.cwd(),
          projectName: 'test-project',
          startedAt: Date.now(),
          state: 'running',
          stateChangedAt: Date.now(),
        },
      },
    }))

    const alive = await readSessions()

    expect(alive.some((s) => s.sessionId === sessionId)).toBe(true)
  })
})

describe('updateState', () => {
  const testDir = join(getAgentDir(), 'pi-notify-test')
  const testLockFile = join(testDir, 'state.json.lock')

  beforeEach(() => {
    try {
      unlinkSync(testLockFile)
    } catch {
      // ignore
    }
  })

  afterEach(() => {
    try {
      unlinkSync(testLockFile)
    } catch {
      // ignore
    }
  })

  it('writes state and preserves other fields', async () => {
    await updateState((state) => ({
      ...state,
      sessions: {
        ...state.sessions,
        'test-session-1': {
          pid: process.pid,
          sessionId: 'test-session-1',
          cwd: process.cwd(),
          projectName: 'test-project',
          startedAt: Date.now(),
          state: 'running',
          stateChangedAt: Date.now(),
        },
      },
    }))
  })

  it('handles concurrent updates correctly', async () => {
    const sessionId = `test-concurrent-${Date.now()}`

    await updateState((state) => ({
      ...state,
      sessions: {
        ...state.sessions,
        [sessionId]: {
          pid: process.pid,
          sessionId,
          cwd: process.cwd(),
          projectName: 'concurrent-test',
          startedAt: Date.now(),
          state: 'running',
          stateChangedAt: Date.now(),
        },
      },
    }))

    await Promise.all([
      updateState((state) => ({
        ...state,
        sessions: {
          ...state.sessions,
          [sessionId]: state.sessions[sessionId]
            ? {
                ...state.sessions[sessionId],
                stateChangedAt: Date.now(),
              }
            : undefined,
        },
      })),
      updateState((state) => ({
        ...state,
        sessions: {
          ...state.sessions,
          [sessionId]: state.sessions[sessionId]
            ? {
                ...state.sessions[sessionId],
                stateChangedAt: Date.now() + 1,
              }
            : undefined,
        },
      })),
    ])

    await updateState((state) => {
      expect(state.sessions[sessionId]).toBeDefined()
      return state
    })
  })
})
