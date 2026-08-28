import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { describe, expect, it, vi } from 'vitest'

import type { StateTracker } from '../state-tracker.js'
import { SessionStore } from './session-store.js'

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
  pid: 12345,
  cwd: '/test/project',
  projectName: 'test-project',
}

describe('SessionStore', () => {
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

    expect(emitSpy).toHaveBeenCalledTimes(2)
    expect(emitSpy).toHaveBeenCalledWith('running', expect.any(Function))
    expect(emitSpy).toHaveBeenCalledWith('idle', expect.any(Function))
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
})
