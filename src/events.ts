import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

import type { ResolvedNotifyConfig } from './config.js'
import { Registrar } from './shared/registrar.js'
import type { NotifyAction } from './shared/types.js'

export const PI_NOTIFY_EVENT = 'pi-notify:notify'

export class EventsNotifier extends Registrar {
  private readonly config: ResolvedNotifyConfig

  constructor(pi: ExtensionAPI, config: ResolvedNotifyConfig) {
    super(pi)
    this.config = config
  }

  protected override setup(notify: NotifyAction): void {
    for (const [channel, message] of Object.entries(this.config.events)) {
      if (!message) continue
      const unsubscribe = this.pi.events.on(channel, () => {
        notify(message)
      })
      this.unsubscribes.push(unsubscribe)
    }

    const customEventUnsub = this.pi.events.on(PI_NOTIFY_EVENT, (payload) => {
      notify(String(payload))
    })
    this.unsubscribes.push(customEventUnsub)
  }
}
