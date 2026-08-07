import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

import type { ResolvedNotifyConfig } from './config.js'
import type { JobTracker } from './jobs.js'
import type { NotifyAction } from './types.js'

export class FinishedNotifier {
  constructor(
    private readonly pi: ExtensionAPI,
    private readonly config: ResolvedNotifyConfig,
    private readonly jobTracker: JobTracker,
  ) {}

  register(notify: NotifyAction): void {
    if (!this.config.finished) return

    this.pi.on('agent_settled', () => {
      if (this.jobTracker.hasActiveJobs) return
      notify('Ready for input')
    })
  }
}
