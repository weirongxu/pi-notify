import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

import type { ResolvedNotifyConfig } from './config.js'
import type { TmuxTitleTracker } from './tmux-title.js'
import type { Unsubscribe } from './types.js'

// xterm focus reporting (CSI ?1004): emitted by the terminal on focus gain/loss.
const FOCUS_IN = '\x1b[I'
const FOCUS_OUT = '\x1b[O'
const ENABLE_FOCUS_REPORTING = '\x1b[?1004h'
const DISABLE_FOCUS_REPORTING = '\x1b[?1004l'

// TODO review

export class FocusTracker {
  private _focused: boolean | undefined = undefined
  private _lastActivityAt = Date.now()
  private unsubscribe: Unsubscribe | undefined

  constructor(
    private readonly pi: ExtensionAPI,
    private readonly titleTracker: TmuxTitleTracker,
    private readonly config: ResolvedNotifyConfig,
  ) {}

  get isFocused(): boolean | undefined {
    return this._focused
  }

  /** Timestamp of the last observed terminal input (fallback focus signal). */
  get lastActivityAt(): number {
    return this._lastActivityAt
  }

  register(): void {
    this.pi.on('session_start', (_event, ctx) => {
      const activate =
        ctx.mode === 'tui' &&
        (this.titleTracker.enabled || this.config.onlyNotifyWhenUnfocused)
      if (!activate) return
      this._lastActivityAt = Date.now()
      process.stdout.write(ENABLE_FOCUS_REPORTING)
      this.unsubscribe = ctx.ui.onTerminalInput((data) => {
        this._lastActivityAt = Date.now()
        const result = this.consume(data)
        if (result.gainedFocus) this.titleTracker.restore()
        return result.data === data ? undefined : { data: result.data }
      })
    })
    this.pi.on('session_shutdown', () => {
      this.stop()
    })
  }

  stop(): void {
    if (this.unsubscribe) {
      process.stdout.write(DISABLE_FOCUS_REPORTING)
      this.unsubscribe()
      this.unsubscribe = undefined
    }
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
