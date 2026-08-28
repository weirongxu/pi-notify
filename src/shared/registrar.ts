import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

import type { NotifyAction, Unsubscribe } from './types.js'

export abstract class Registrar {
  protected readonly pi: ExtensionAPI
  protected registered = false
  protected unsubscribes: Unsubscribe[] = []

  constructor(pi: ExtensionAPI) {
    this.pi = pi
  }

  register(notify: NotifyAction): void {
    if (this.registered) return
    this.registered = true
    this.setup(notify)
    this.pi.on('session_shutdown', () => {
      this.stop()
    })
  }

  protected abstract setup(notify: NotifyAction): void

  stop(): void {
    for (const unsubscribe of this.unsubscribes) unsubscribe()
    this.unsubscribes = []
    this.registered = false
  }
}
