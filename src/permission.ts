import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

import type { ResolvedNotifyConfig } from './config.js'
import type { NotifyAction, Unsubscribe } from './types.js'

/**
 * Broadcast by `@gotgenes/pi-permission-system` immediately before it shows the
 * approval UI. Soft dependency: only fires when that package is installed.
 *
 * Note: This string is not exported by pi-permission-system, so it's duplicated here.
 * If the channel name changes in the upstream package, this should be updated.
 * Source: https://github.com/gotgenes/pi-packages (pi-permission-system package)
 */
const PERMISSIONS_UI_PROMPT_CHANNEL = 'permissions:ui_prompt'

export class PermissionNotifier {
  private unsubscribe: Unsubscribe | undefined

  constructor(
    private readonly pi: ExtensionAPI,
    private readonly config: ResolvedNotifyConfig,
  ) {}

  register(notify: NotifyAction): void {
    this.pi.on('session_start', () => {
      if (!this.config.permission) return
      this.unsubscribe = this.pi.events.on(
        PERMISSIONS_UI_PROMPT_CHANNEL,
        () => {
          notify('Permission prompt')
        },
      )
    })
    this.pi.on('session_shutdown', () => {
      this.stop()
    })
  }

  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = undefined
  }
}
