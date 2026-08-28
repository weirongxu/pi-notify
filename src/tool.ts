import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

import type { ResolvedNotifyConfig } from './config.js'
import { Registrar } from './shared/registrar.js'
import type { NotifyAction } from './shared/types.js'

export class ToolCallNotifier extends Registrar {
  private readonly config: ResolvedNotifyConfig

  constructor(pi: ExtensionAPI, config: ResolvedNotifyConfig) {
    super(pi)
    this.config = config
  }

  protected override setup(notify: NotifyAction): void {
    this.pi.on('tool_call', (event) => {
      if (!this.config.notifyTools.has(event.toolName)) return
      notify(`Tool call: ${event.toolName}`)
    })
  }
}
