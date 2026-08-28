import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

import type { ResolvedNotifyConfig } from './config.js'
import { Registrar } from './shared/registrar.js'
import type { TmuxTitleTracker } from './tmux-title.js'

const FOCUS_IN = '\x1b[I'
const FOCUS_OUT = '\x1b[O'
const ENABLE_FOCUS_REPORTING = '\x1b[?1004h'
const DISABLE_FOCUS_REPORTING = '\x1b[?1004l'

export class FocusTracker extends Registrar {
  private readonly titleTracker: TmuxTitleTracker
  private readonly config: ResolvedNotifyConfig
  private _focused: boolean | undefined = undefined
  private _lastActivityAt = Date.now()

  constructor(
    pi: ExtensionAPI,
    titleTracker: TmuxTitleTracker,
    config: ResolvedNotifyConfig,
  ) {
    super(pi)
    this.titleTracker = titleTracker
    this.config = config
  }

  get isFocused(): boolean | undefined {
    return this._focused
  }

  get lastActivityAt(): number {
    return this._lastActivityAt
  }

  protected override setup(): void {
    this.pi.on('session_start', (_event, ctx) => {
      const activate =
        ctx.mode === 'tui' &&
        (this.titleTracker.enabled || this.config.onlyNotifyWhenUnfocused)
      if (!activate) return
      this._lastActivityAt = Date.now()
      process.stdout.write(ENABLE_FOCUS_REPORTING)
      this.unsubscribes.push(
        ctx.ui.onTerminalInput((data) => {
          this._lastActivityAt = Date.now()
          const result = this.consume(data)
          if (result.gainedFocus) this.titleTracker.restore()
          if (result.data !== data) return { consume: true }
          return undefined
        }),
      )
    })
  }

  override stop(): void {
    process.stdout.write(DISABLE_FOCUS_REPORTING)
    super.stop()
    this._focused = undefined
  }

  private consume(data: string): { data: string; gainedFocus: boolean } {
    let current = data
    let gainedFocus = false

    if (current.includes(FOCUS_IN)) {
      this._focused = true
      gainedFocus = true
      current = current.split(FOCUS_IN).join('')
    }
    if (current.includes(FOCUS_OUT)) {
      this._focused = false
      current = current.split(FOCUS_OUT).join('')
    }

    return { data: current, gainedFocus }
  }
}
