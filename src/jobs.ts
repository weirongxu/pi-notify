import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

import type { Unsubscribe } from './types.js'

export const JOB_START_EVENT = 'desktop-notify:job:start'
export const JOB_END_EVENT = 'desktop-notify:job:end'

export class JobTracker {
  private activeJobs = new Set<string>()
  private unsubscribes: Unsubscribe[] = []
  private registered = false

  constructor(private readonly pi: ExtensionAPI) {}

  get hasActiveJobs(): boolean {
    return this.activeJobs.size > 0
  }

  register(): void {
    if (this.registered) return
    this.registered = true

    const startUnsub = this.pi.events.on(JOB_START_EVENT, (params) => {
      if (
        typeof params === 'object' &&
        params !== null &&
        'id' in params &&
        typeof params.id === 'string'
      ) {
        this.activeJobs.add(params.id)
      }
    })
    this.unsubscribes.push(startUnsub)

    const endUnsub = this.pi.events.on(JOB_END_EVENT, (params) => {
      if (
        typeof params === 'object' &&
        params !== null &&
        'id' in params &&
        typeof params.id === 'string'
      ) {
        this.activeJobs.delete(params.id)
      }
    })
    this.unsubscribes.push(endUnsub)

    this.pi.on('session_shutdown', () => {
      this.stop()
    })
  }

  stop(): void {
    this.unsubscribes.forEach((unsub) => {
      unsub()
    })
    this.unsubscribes = []
    this.activeJobs.clear()
    this.registered = false
  }
}
