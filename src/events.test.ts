import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { describe, expect, it } from 'vitest'

import type { ResolvedNotifyConfig } from './config.js'
import { EventsNotifier } from './events.js'

type EventsListener = (payload: unknown) => void

interface FakePi {
  eventListeners: Map<string, Set<EventsListener>>
  listeners: Map<string, Set<(...args: unknown[]) => void>>
  events: { on(event: string, listener: EventsListener): () => void }
  on(event: string, listener: (...args: unknown[]) => void): void
}

function makeFakePi(): FakePi {
  const eventListeners = new Map<string, Set<EventsListener>>()
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>()
  return {
    eventListeners,
    listeners,
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
    on(event, listener) {
      let set = listeners.get(event)
      if (!set) {
        set = new Set()
        listeners.set(event, set)
      }
      set.add(listener)
    },
  }
}

function makeConfig(
  events: ResolvedNotifyConfig['events'],
): ResolvedNotifyConfig {
  return {
    enabled: true,
    notifyTools: new Set<string>(),
    events,
    finished: true,
    finishedThrottleMs: 0,
    onlyNotifyWhenUnfocused: true,
    unfocusedActivityThresholdMs: 0,
    tmuxSymbol: '',
  }
}

function emitEvent(pi: FakePi, event: string, payload?: unknown): void {
  const set = pi.eventListeners.get(event)
  if (!set) return
  for (const listener of [...set]) listener(payload)
}

describe('EventsNotifier', () => {
  it('notifies with the configured message when a custom event fires', () => {
    const pi = makeFakePi()
    const notifier = new EventsNotifier(
      pi as unknown as ExtensionAPI,
      makeConfig({
        'my:custom:event': 'Custom event triggered',
      }),
    )
    const bodies: string[] = []
    notifier.register((body) => bodies.push(body))

    emitEvent(pi, 'my:custom:event')

    expect(bodies).toEqual(['Custom event triggered'])
  })

  it('does not notify for events disabled with false', () => {
    const pi = makeFakePi()
    const notifier = new EventsNotifier(
      pi as unknown as ExtensionAPI,
      makeConfig({
        'my:custom:event': false,
      }),
    )
    const bodies: string[] = []
    notifier.register((body) => bodies.push(body))

    emitEvent(pi, 'my:custom:event')

    expect(bodies).toEqual([])
  })

  it('does not notify for events disabled with an empty string (backward compatibility)', () => {
    const pi = makeFakePi()
    const notifier = new EventsNotifier(
      pi as unknown as ExtensionAPI,
      makeConfig({
        'my:custom:event': '',
      }),
    )
    const bodies: string[] = []
    notifier.register((body) => bodies.push(body))

    emitEvent(pi, 'my:custom:event')

    expect(bodies).toEqual([])
  })
})
