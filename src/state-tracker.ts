import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import Emittery from 'emittery'

import type { JobTracker } from './jobs.js'
import { Registrar } from './shared/registrar.js'

const IDLE_TIMEOUT_MS = 10000

export class StateTracker extends Registrar {
  readonly events = new Emittery<{
    running: never
    idle: never
  }>()

  private readonly jobTracker: JobTracker
  private idleTimer: NodeJS.Timeout | null = null

  constructor(pi: ExtensionAPI, jobTracker: JobTracker) {
    super(pi)
    this.jobTracker = jobTracker
  }

  private startIdleTimer(): void {
    if (this.jobTracker.hasActiveJobs) return
    this.clearIdleTimer()
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null
      void this.events.emit('idle')
    }, IDLE_TIMEOUT_MS)
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
  }

  protected override setup(): void {
    this.pi.on('turn_start', () => {
      this.clearIdleTimer()
    })

    this.pi.on('message_start', () => {
      this.clearIdleTimer()
    })

    this.pi.on('agent_settled', () => {
      this.startIdleTimer()
    })

    this.pi.on('tool_call', () => {
      this.clearIdleTimer()
    })

    this.unsubscribes.push(
      this.jobTracker.onEnd(() => {
        this.startIdleTimer()
      }),
    )
  }

  override stop(): void {
    super.stop()
    this.clearIdleTimer()
  }
}
