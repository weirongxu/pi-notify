import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

import type { ResolvedNotifyConfig } from './config.js'
import { Registrar } from './shared/registrar.js'
import type { NotifyAction } from './shared/types.js'
import type { StateTracker } from './state-tracker.js'

export class IdleNotifier extends Registrar {
  private readonly config: ResolvedNotifyConfig
  private readonly stateTracker: StateTracker
  private hasActivity = false

  constructor(
    pi: ExtensionAPI,
    config: ResolvedNotifyConfig,
    stateTracker: StateTracker,
  ) {
    super(pi)
    this.config = config
    this.stateTracker = stateTracker
  }

  protected override setup(notify: NotifyAction): void {
    if (!this.config.finished) return

    this.pi.on('turn_start', () => {
      this.hasActivity = true
    })

    this.unsubscribes.push(
      this.stateTracker.events.on('idle', () => {
        if (!this.hasActivity) return
        notify('Idle')
      }),
    )
  }
}
