import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

import type { ResolvedNotifyConfig } from './config.js'
import type { NotifyAction, Unsubscribe } from './types.js'

export class EventsNotifier {
  private unsubscribes: Unsubscribe[] = []
  private registered = false

  constructor(
    private readonly pi: ExtensionAPI,
    private readonly config: ResolvedNotifyConfig,
  ) {}

  register(notify: NotifyAction): void {
    if (this.registered) return
    this.registered = true

    for (const [channel, message] of Object.entries(this.config.events)) {
      if (!message) continue
      this.subscribeCustomEvent(channel, notify, message)
    }

    this.pi.on('session_shutdown', () => {
      this.stop()
    })
  }

  stop(): void {
    this.unsubscribes.forEach((unsub) => {
      unsub()
    })
    this.unsubscribes = []
    this.registered = false
  }

  private subscribeCustomEvent(
    channel: string,
    notify: NotifyAction,
    message: string,
  ): void {
    const unsubscribe = this.pi.events.on(channel, () => {
      notify(message)
    })
    this.unsubscribes.push(unsubscribe)
  }
}
