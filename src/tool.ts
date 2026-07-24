import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

import type { ResolvedNotifyConfig } from './config.js'
import type { NotifyAction } from './types.js'

export class ToolCallNotifier {
  constructor(
    private readonly pi: ExtensionAPI,
    private readonly config: ResolvedNotifyConfig,
  ) {}

  register(notify: NotifyAction): void {
    this.pi.on('tool_call', (event) => {
      if (!this.config.notifyTools.has(event.toolName)) return
      notify(`Tool call: ${event.toolName}`)
    })
  }
}
