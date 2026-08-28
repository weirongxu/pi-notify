import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

export class SessionState {
  private readonly pi: ExtensionAPI
  public hasUI = false

  constructor(pi: ExtensionAPI) {
    this.pi = pi
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
