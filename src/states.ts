import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

export class SessionState {
  public hasUI = false

  constructor(private readonly pi: ExtensionAPI) {
    this.register()
  }

  private register(): void {
    this.pi.on('session_start', (_event, ctx) => {
      this.hasUI = ctx.hasUI
    })
    this.pi.on('session_shutdown', () => {
      this.hasUI = false
    })
  }
}
