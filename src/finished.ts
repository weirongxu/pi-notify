import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

import type { ResolvedNotifyConfig } from './config.js'
import type { NotifyAction } from './types.js'

export class FinishedNotifier {
  constructor(
    private readonly pi: ExtensionAPI,
    private readonly config: ResolvedNotifyConfig,
  ) {}

  register(notify: NotifyAction): void {
    if (!this.config.finished) return
    this.pi.on('agent_settled', () => {
      notify('Ready for input')
    })
  }
}
