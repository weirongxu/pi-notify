import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { describe, expect, it, vi } from 'vitest'

import { Registrar } from './registrar.js'
import type { NotifyAction, Unsubscribe } from './types.js'

type Listener = (...args: unknown[]) => void
type EventsListener = (payload: unknown) => void

interface FakePi {
  listeners: Map<string, Set<Listener>>
  eventListeners: Map<string, Set<EventsListener>>
  on(event: string, listener: Listener): void
  events: { on(event: string, listener: EventsListener): Unsubscribe }
  emit(event: string, ...args: unknown[]): void
  emitEvent(event: string, payload: unknown): void
}

function makeFakePi(): FakePi {
  const listeners = new Map<string, Set<Listener>>()
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
  }
  return pi
}

class TrackingRegistrar extends Registrar {
  setupCalls = 0
  notifyUsed: NotifyAction | undefined
  stopCalls = 0

  protected override setup(notify: NotifyAction): void {
    this.setupCalls += 1
    this.notifyUsed = notify
    const unsub: Unsubscribe = () => {}
    this.unsubscribes.push(unsub)
    this.unsubscribes.push(unsub)
  }

  override stop(): void {
    super.stop()
    this.stopCalls += 1
  }

  get isRegistered() {
    return this.registered
  }
  get unsubscribesCount() {
    return this.unsubscribes.length
  }
}

describe('Registrar', () => {
  it('runs setup once and is idempotent', () => {
    const pi = makeFakePi()
    const reg = new TrackingRegistrar(pi as unknown as ExtensionAPI)
    const notify = vi.fn() as unknown as NotifyAction
    reg.register(notify)
    reg.register(notify)
    expect(reg.setupCalls).toBe(1)
    expect(reg.notifyUsed).toBe(notify)
  })

  it('passes notify to setup', () => {
    const pi = makeFakePi()
    const reg = new TrackingRegistrar(pi as unknown as ExtensionAPI)
    const notify = vi.fn() as unknown as NotifyAction
    reg.register(notify)
    expect(reg.notifyUsed).toBe(notify)
  })

  it('triggers stop on session_shutdown', () => {
    const pi = makeFakePi()
    const reg = new TrackingRegistrar(pi as unknown as ExtensionAPI)
    const notify = vi.fn() as unknown as NotifyAction
    reg.register(notify)
    expect(reg.stopCalls).toBe(0)
    pi.emit('session_shutdown')
    expect(reg.stopCalls).toBe(1)
    expect(reg.isRegistered).toBe(false)
  })

  it('clears unsubscribes on stop', () => {
    const pi = makeFakePi()
    const reg = new TrackingRegistrar(pi as unknown as ExtensionAPI)
    const notify = vi.fn() as unknown as NotifyAction
    reg.register(notify)
    expect(reg.unsubscribesCount).toBe(2)
    reg.stop()
    expect(reg.unsubscribesCount).toBe(0)
    expect(reg.isRegistered).toBe(false)
  })

  it('re-registers after stop', () => {
    const pi = makeFakePi()
    const reg = new TrackingRegistrar(pi as unknown as ExtensionAPI)
    const notify = vi.fn() as unknown as NotifyAction
    reg.register(notify)
    pi.emit('session_shutdown')
    expect(reg.setupCalls).toBe(1)
    reg.register(notify)
    expect(reg.setupCalls).toBe(2)
  })
})
