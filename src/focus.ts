import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

import type { ResolvedNotifyConfig } from './config.js'
import { FocusInputScanner } from './focus-scanner.js'
import { Registrar } from './shared/registrar.js'
import type { TmuxTitleTracker } from './tmux-title.js'

export class FocusTracker extends Registrar {
  private readonly titleTracker: TmuxTitleTracker
  private readonly config: ResolvedNotifyConfig
  private readonly scanner: FocusInputScanner
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
    this.scanner = new FocusInputScanner({
      onActivity: () => {
        this.touch()
      },
      onFocus: (focused) => {
        this.touch()
        this._focused = focused
        if (focused) this.titleTracker.restore()
      },
    })
  }

  get isFocused(): boolean | undefined {
    return this._focused
  }

  get lastActivityAt(): number {
    return this._lastActivityAt
  }

  private touch(): void {
    this._lastActivityAt = Date.now()
  }

  protected override setup(): void {
    this.pi.on('session_start', (_event, ctx) => {
      const activate =
        ctx.mode === 'tui' &&
        (this.titleTracker.enabled || this.config.onlyNotifyWhenUnfocused)
      if (!activate) return
      this.touch()
      this.scanner.start()
    })
  }

  // Known limitation: focus reporting (1004) can get disabled on TUI fullscreen switches; not handled here.
  override stop(): void {
    this.scanner.stop()
    super.stop()
    this._focused = undefined
  }
}
