import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

import type { ResolvedNotifyConfig } from './config.js'
import type { JobTracker } from './jobs.js'
import type { NotifyAction } from './types.js'

const IDLE_TIMEOUT_MS = 10000

export class IdleNotifier {
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly pi: ExtensionAPI,
    private readonly config: ResolvedNotifyConfig,
    private readonly jobTracker: JobTracker,
  ) {}

  clearIdleTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
  startIdleTimer(notify: NotifyAction): void {
    this.clearIdleTimer()
    this.timer = setTimeout(() => {
      this.clearIdleTimer()
      notify('Idle')
    }, IDLE_TIMEOUT_MS)
  }

  register(notify: NotifyAction): void {
    if (!this.config.finished) return

    this.pi.on('turn_start', () => {
      this.clearIdleTimer()
    })

    this.pi.on('agent_settled', () => {
      if (this.jobTracker.hasActiveJobs) return
      this.startIdleTimer(notify)
    })

    this.jobTracker.onEnd(() => {
      this.startIdleTimer(notify)
    })
  }
}
