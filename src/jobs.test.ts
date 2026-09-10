import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { describe, expect, it, vi } from 'vitest'

import { JOB_END_EVENT, JOB_START_EVENT, JobTracker } from './jobs.js'

type EventsListener = (payload?: unknown) => void

interface FakePi {
  on(event: string, listener: (payload?: unknown) => void): () => void
  events: { on(event: string, listener: EventsListener): () => void }
  emitEvent(event: string, payload?: unknown): void
}

function makeFakePi(): FakePi {
  const eventListeners = new Map<string, Set<EventsListener>>()
  return {
    on() {
      return () => {}
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
    emitEvent(event, payload) {
      const set = eventListeners.get(event)
      if (!set) return
      for (const listener of [...set]) listener(payload)
    },
  }
}

function makeTracker(pi: FakePi = makeFakePi()): JobTracker {
  const tracker = new JobTracker(pi as unknown as ExtensionAPI)
  tracker.register(() => {})
  return tracker
}

describe('JobTracker', () => {
  it('fires onStart listeners on job start', () => {
    const pi = makeFakePi()
    const tracker = makeTracker(pi)
    const onStart = vi.fn()

    tracker.onStart(onStart)

    pi.emitEvent(JOB_START_EVENT, { id: 'job-1' })

    expect(onStart).toHaveBeenCalledOnce()
    expect(tracker.hasActiveJobs).toBe(true)
  })

  it('stops firing onStart after unsubscribe', () => {
    const pi = makeFakePi()
    const tracker = makeTracker(pi)
    const onStart = vi.fn()

    const unsubscribe = tracker.onStart(onStart)
    unsubscribe()

    pi.emitEvent(JOB_START_EVENT, { id: 'job-1' })

    expect(onStart).not.toHaveBeenCalled()
  })

  it('fires onEnd while the job is still active', () => {
    const pi = makeFakePi()
    const tracker = makeTracker(pi)

    pi.emitEvent(JOB_START_EVENT, { id: 'job-1' })

    let activeDuringEnd: boolean | undefined
    tracker.onEnd(() => {
      activeDuringEnd = tracker.hasActiveJobs
    })
    pi.emitEvent(JOB_END_EVENT, { id: 'job-1' })

    expect(activeDuringEnd).toBe(true)
    expect(tracker.hasActiveJobs).toBe(false)
  })

  it('drops old listeners when re-registering after stop', () => {
    const pi = makeFakePi()
    const tracker = makeTracker(pi)
    const oldListener = vi.fn()
    const newListener = vi.fn()

    tracker.onStart(oldListener)
    tracker.stop()
    tracker.register(() => {})
    tracker.onStart(newListener)

    pi.emitEvent(JOB_START_EVENT, { id: 'job-1' })

    expect(oldListener).not.toHaveBeenCalled()
    expect(newListener).toHaveBeenCalledOnce()
  })
})
