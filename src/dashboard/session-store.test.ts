import { rmSync, unlinkSync } from 'node:fs'
import { dirname } from 'node:path'

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

vi.mock('./consts.js', async () => {
  const { mkdtempSync } = await import('node:fs')
  const path = await import('node:path')
  const { tmpdir } = await import('node:os')

  const stateDir = mkdtempSync(path.join(tmpdir(), 'pi-notify-test-'))
  return {
    STATE_FILE: path.join(stateDir, 'state.json'),
    STATE_TMP_FILE: path.join(stateDir, 'state.json.tmp'),
  }
})

import type { ResolvedNotifyConfig } from '../config.js'
import type { JobTracker } from '../jobs.js'
import { StateTracker } from '../state-tracker.js'
import { STATE_FILE } from './consts.js'
import { SessionStore } from './session-store.js'
import { readState, updateState } from './state-store.js'

type EventsListener = (payload: unknown) => void

interface FakeStateTracker {
  events: {
    on(event: string, listener: EventsListener): () => void
    emit(event: string, data?: unknown): void
  }
}

interface FakeSessionManager {
  getSessionId(): string
}

interface FakePiContext {
  cwd: string
  sessionManager: FakeSessionManager
}

interface FakePi {
  listeners: Map<string, Set<(...args: unknown[]) => void>>
  eventListeners: Map<string, Set<EventsListener>>
  on(event: string, listener: (...args: unknown[]) => void): void
  events: { on(event: string, listener: EventsListener): () => void }
  emit(event: string, ...args: unknown[]): void
  emitEvent(event: string, payload: unknown): void
  emitSessionStart(ctx: FakePiContext): void
}

function makeFakePi(): FakePi {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>()
  const eventListeners = new Map<string, Set<EventsListener>>()
  const pi: FakePi = {
    listeners,
    eventListeners,
    on(event, listener) {
      let set = listeners.get(event)
      if (!set) {
        set = new Set()
        listeners.set(event, set)
      }
      set.add(listener)
    },
    events: {
      on(event, listener) {
        let set = eventListeners.get(event)
        if (!set) {
          set = new Set()
          eventListeners.set(event, set)
        }
        set.add(listener)
        return () => {
          set.delete(listener)
        }
      },
    },
    emit(event, ...args) {
      const set = listeners.get(event)
      if (!set) return
      for (const listener of [...set]) listener(...args)
    },
    emitEvent(event, payload) {
      const set = eventListeners.get(event)
      if (!set) return
      for (const listener of [...set]) listener(payload)
    },
    emitSessionStart(ctx) {
      const set = listeners.get('session_start')
      if (!set) return
      for (const listener of [...set]) listener(undefined, ctx)
    },
  }
  return pi
}

function makeFakeStateTracker(): FakeStateTracker {
  const listeners = new Map<string, Set<EventsListener>>()
  return {
    events: {
      on(event, listener) {
        let set = listeners.get(event)
        if (!set) {
          set = new Set()
          listeners.set(event, set)
        }
        set.add(listener)
        return () => {
          set.delete(listener)
        }
      },
      emit(event, data?: unknown) {
        const set = listeners.get(event)
        if (!set) return
        for (const listener of [...set]) listener({ data })
      },
    },
  }
}

const SESSION_ID = 'test-session-123'
const META = {
  cwd: '/test/project',
  projectName: 'test-project',
}

afterAll(() => {
  rmSync(dirname(STATE_FILE), { recursive: true, force: true })
})

describe('SessionStore', () => {
  const testLockFile = `${STATE_FILE}.lock`

  beforeEach(async () => {
    try {
      unlinkSync(testLockFile)
    } catch {
      // ignore
    }
    await updateState(() => ({ version: 2, sessions: {} }))
  })

  afterEach(() => {
    try {
      unlinkSync(testLockFile)
    } catch {
      // ignore
    }
  })

  it('creates instance and registers event listeners', () => {
    const pi = makeFakePi()
    const stateTracker = makeFakeStateTracker()
    const emitSpy = vi.spyOn(stateTracker.events, 'on')
    const piOnSpy = vi.spyOn(pi, 'on')

    const store = new SessionStore(
      pi as unknown as ExtensionAPI,
      stateTracker as unknown as StateTracker,
    )
    store.register(vi.fn())

    expect(emitSpy).toHaveBeenCalledTimes(5)
    expect(emitSpy).toHaveBeenCalledWith('running', expect.any(Function))
    expect(emitSpy).toHaveBeenCalledWith('idle', expect.any(Function))
    expect(emitSpy).toHaveBeenCalledWith('tool', expect.any(Function))
    expect(emitSpy).toHaveBeenCalledWith('ui_prompt', expect.any(Function))
    expect(emitSpy).toHaveBeenCalledWith('event', expect.any(Function))
    expect(piOnSpy).toHaveBeenCalledWith('session_start', expect.any(Function))
  })

  it('handles session_start event without errors', () => {
    const pi = makeFakePi()
    const stateTracker = makeFakeStateTracker()

    const store = new SessionStore(
      pi as unknown as ExtensionAPI,
      stateTracker as unknown as StateTracker,
    )
    store.register(vi.fn())

    expect(() => {
      pi.emitSessionStart({
        cwd: META.cwd,
        sessionManager: { getSessionId: () => SESSION_ID },
      })
    }).not.toThrow()
  })

  it('handles running event without errors', () => {
    const pi = makeFakePi()
    const stateTracker = makeFakeStateTracker()

    const store = new SessionStore(
      pi as unknown as ExtensionAPI,
      stateTracker as unknown as StateTracker,
    )
    store.register(vi.fn())

    pi.emitSessionStart({
      cwd: META.cwd,
      sessionManager: { getSessionId: () => SESSION_ID },
    })

    expect(() => {
      stateTracker.events.emit('running')
    }).not.toThrow()
  })

  it('handles idle event without errors', () => {
    const pi = makeFakePi()
    const stateTracker = makeFakeStateTracker()

    const store = new SessionStore(
      pi as unknown as ExtensionAPI,
      stateTracker as unknown as StateTracker,
    )
    store.register(vi.fn())

    pi.emitSessionStart({
      cwd: META.cwd,
      sessionManager: { getSessionId: () => SESSION_ID },
    })

    expect(() => {
      stateTracker.events.emit('idle')
    }).not.toThrow()
  })

  it('ignores running event when session not started', () => {
    const pi = makeFakePi()
    const stateTracker = makeFakeStateTracker()

    const store = new SessionStore(
      pi as unknown as ExtensionAPI,
      stateTracker as unknown as StateTracker,
    )
    store.register(vi.fn())

    expect(() => {
      stateTracker.events.emit('running')
    }).not.toThrow()
  })

  it('ignores idle event when session not started', () => {
    const pi = makeFakePi()
    const stateTracker = makeFakeStateTracker()

    const store = new SessionStore(
      pi as unknown as ExtensionAPI,
      stateTracker as unknown as StateTracker,
    )
    store.register(vi.fn())

    expect(() => {
      stateTracker.events.emit('idle')
    }).not.toThrow()
  })

  it('writes running and idle states to state.json', async () => {
    const pi = makeFakePi()
    const stateTracker = makeFakeStateTracker()

    const store = new SessionStore(
      pi as unknown as ExtensionAPI,
      stateTracker as unknown as StateTracker,
    )
    store.register(() => {})

    pi.emitSessionStart({
      cwd: META.cwd,
      sessionManager: { getSessionId: () => SESSION_ID },
    })
    await new Promise((resolve) => setTimeout(resolve, 10))

    stateTracker.events.emit('running')
    await new Promise((resolve) => setTimeout(resolve, 10))

    let record = readState().sessions[String(process.pid)]
    expect(record?.state).toBe('running')

    stateTracker.events.emit('idle')
    await new Promise((resolve) => setTimeout(resolve, 10))

    record = readState().sessions[String(process.pid)]
    expect(record?.state).toBe('idle')
  })

  it('stops without errors after session started', () => {
    const pi = makeFakePi()
    const stateTracker = makeFakeStateTracker()

    const store = new SessionStore(
      pi as unknown as ExtensionAPI,
      stateTracker as unknown as StateTracker,
    )
    store.register(vi.fn())

    pi.emitSessionStart({
      cwd: META.cwd,
      sessionManager: { getSessionId: () => SESSION_ID },
    })

    expect(() => {
      store.stop()
    }).not.toThrow()
  })

  it('clears runningSince on idle transition without accumulating duration', async () => {
    await updateState(() => ({ version: 2, sessions: {} }))
    const now = Date.now()
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now)
    const pi = makeFakePi()
    const stateTracker = makeFakeStateTracker()
    const store = new SessionStore(
      pi as unknown as ExtensionAPI,
      stateTracker as unknown as StateTracker,
    )
    store.register(() => {})

    pi.emitSessionStart({
      cwd: META.cwd,
      sessionManager: { getSessionId: () => SESSION_ID },
    })
    await new Promise((resolve) => setTimeout(resolve, 20))

    stateTracker.events.emit('running')
    await new Promise((resolve) => setTimeout(resolve, 20))

    nowSpy.mockReturnValue(now + 5000)
    stateTracker.events.emit('idle')
    await new Promise((resolve) => setTimeout(resolve, 20))

    const record = readState().sessions[String(process.pid)]
    expect(record).not.toHaveProperty('runningTime')
    expect(record?.startedRunningAt).toBeUndefined()
    nowSpy.mockRestore()
  })

  it('updates state immediately on event emission', async () => {
    await updateState(() => ({ version: 2, sessions: {} }))
    const pi = makeFakePi()
    const jobTracker = {
      hasActiveJobs: false,
      onStart: () => () => {},
      onEnd: () => () => {},
    } as unknown as JobTracker
    const tracker = new StateTracker(
      pi as unknown as ExtensionAPI,
      jobTracker,
      {
        notifyTools: new Set(['bash']),
        events: { 'permissions:ui_prompt': 'msg' },
      } as unknown as ResolvedNotifyConfig,
    )
    tracker.register(() => {})

    const store = new SessionStore(pi as unknown as ExtensionAPI, tracker)
    store.register(() => {})

    pi.emitSessionStart({
      cwd: META.cwd,
      sessionManager: { getSessionId: () => SESSION_ID },
    })
    await new Promise((resolve) => setTimeout(resolve, 20))

    pi.emitEvent('permissions:ui_prompt', {})
    await new Promise((resolve) => setTimeout(resolve, 20))

    const record = readState().sessions[String(process.pid)]
    expect(record?.state).toBe('event:permissions:ui_prompt')
  })

  it('updates state immediately on ui_prompt emission', async () => {
    await updateState(() => ({ version: 2, sessions: {} }))
    const pi = makeFakePi()
    const jobTracker = {
      hasActiveJobs: false,
      onStart: () => () => {},
      onEnd: () => () => {},
    } as unknown as JobTracker
    const tracker = new StateTracker(
      pi as unknown as ExtensionAPI,
      jobTracker,
      {
        notifyTools: new Set([]),
        events: {},
      } as unknown as ResolvedNotifyConfig,
    )
    tracker.register(() => {})

    const store = new SessionStore(pi as unknown as ExtensionAPI, tracker)
    store.register(() => {})

    pi.emitSessionStart({
      cwd: META.cwd,
      sessionManager: { getSessionId: () => SESSION_ID },
    })
    await new Promise((resolve) => setTimeout(resolve, 20))

    pi.emit('ui_prompt_start', {
      type: 'ui_prompt_start',
      reason: 'ui_prompt',
      kind: 'confirm',
    })

    await new Promise((resolve) => setTimeout(resolve, 20))

    const record = readState().sessions[String(process.pid)]
    expect(record?.state).toBe('ui_prompt:confirm')
  })

  it('does not update state on tool emission outside notifyTools', async () => {
    await updateState(() => ({ version: 2, sessions: {} }))
    const pi = makeFakePi()
    const jobTracker = {
      hasActiveJobs: false,
      onStart: () => () => {},
      onEnd: () => () => {},
    } as unknown as JobTracker
    const tracker = new StateTracker(
      pi as unknown as ExtensionAPI,
      jobTracker,
      {
        notifyTools: new Set(['read']),
        events: {},
      } as unknown as ResolvedNotifyConfig,
    )
    tracker.register(() => {})

    const store = new SessionStore(pi as unknown as ExtensionAPI, tracker)
    store.register(() => {})

    pi.emitSessionStart({
      cwd: META.cwd,
      sessionManager: { getSessionId: () => SESSION_ID },
    })
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(readState().sessions[String(process.pid)]?.state).toBe('idle')

    pi.emit('tool_call', {
      type: 'tool_call',
      toolCallId: 't1',
      toolName: 'grep',
    })
    await new Promise((resolve) => setTimeout(resolve, 20))

    const record = readState().sessions[String(process.pid)]
    expect(record?.state).toBe('idle')
  })

  it('ignores tool and event emissions before session_start', async () => {
    await updateState(() => ({ version: 2, sessions: {} }))
    const pi = makeFakePi()
    const stateTracker = makeFakeStateTracker()
    const store = new SessionStore(
      pi as unknown as ExtensionAPI,
      stateTracker as unknown as StateTracker,
    )
    store.register(() => {})

    stateTracker.events.emit('tool', 'grep')
    stateTracker.events.emit('event', 'permissions:ui_prompt')
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(readState().sessions).toEqual({})
  })
})
