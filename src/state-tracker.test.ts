import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { JobTracker } from './jobs.js'
import { StateTracker } from './state-tracker.js'

interface FakePi {
  listeners: Map<string, Set<() => void>>
  on(event: string, listener: () => void): void
  emit(event: string): void
}

function makeFakePi(): FakePi {
  const listeners = new Map<string, Set<() => void>>()
  return {
    listeners,
    on(event, listener) {
      let set = listeners.get(event)
      if (!set) {
        set = new Set()
        listeners.set(event, set)
      }
      set.add(listener)
    },
    emit(event) {
      const set = listeners.get(event)
      if (!set) return
      for (const listener of [...set]) listener()
    },
  }
}

function makeFakeJobTracker(): JobTracker {
  return {
    hasActiveJobs: false,
    onEnd: () => () => {},
  } as unknown as JobTracker
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

function makeTracker(pi: FakePi): {
  tracker: StateTracker
  states: string[]
} {
  const states: string[] = []
  const tracker = new StateTracker(
    pi as unknown as ExtensionAPI,
    makeFakeJobTracker(),
  )
  tracker.register(() => {})
  tracker.events.on('running', () => {
    states.push('running')
  })
  tracker.events.on('idle', () => {
    states.push('idle')
  })
  return { tracker, states }
}

describe('StateTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits running on turn_start', async () => {
    const pi = makeFakePi()
    const { states } = makeTracker(pi)

    pi.emit('turn_start')

    await flush()

    expect(states).toEqual(['running'])
  })

  it('emits idle after the idle timeout following agent_settled', async () => {
    const pi = makeFakePi()
    const { states } = makeTracker(pi)

    pi.emit('turn_start')
    pi.emit('agent_settled')
    vi.advanceTimersByTime(10000)

    await flush()

    expect(states).toEqual(['running', 'idle'])
  })

  it('does not emit running repeatedly while already running', async () => {
    const pi = makeFakePi()
    const { states } = makeTracker(pi)

    pi.emit('turn_start')
    pi.emit('message_start')
    pi.emit('tool_call')
    pi.emit('turn_start')

    await flush()

    expect(states).toEqual(['running'])
  })

  it('emits running again after becoming idle', async () => {
    const pi = makeFakePi()
    const { states } = makeTracker(pi)

    pi.emit('turn_start')
    pi.emit('agent_settled')
    vi.advanceTimersByTime(10000)
    pi.emit('turn_start')

    await flush()

    expect(states).toEqual(['running', 'idle', 'running'])
  })

  it('resets the idle timer on activity', async () => {
    const pi = makeFakePi()
    const { states } = makeTracker(pi)

    pi.emit('turn_start')
    pi.emit('agent_settled')
    vi.advanceTimersByTime(9000)
    pi.emit('tool_call')
    vi.advanceTimersByTime(9000)

    await flush()

    expect(states).toEqual(['running'])

    pi.emit('agent_settled')
    vi.advanceTimersByTime(10000)

    await flush()

    expect(states).toEqual(['running', 'idle'])
  })
})
