import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

import { readSessions } from './state-store.js'
import { createDashboard } from './ui.js'

export class DashboardCommand {
  constructor(private readonly pi: ExtensionAPI) {}

  register(): void {
    this.pi.registerCommand('notify-dashboard', {
      description: 'Show all pi sessions notify dashboard',
      handler: async (_args, ctx) => {
        const initialSessions = readSessions()

        await ctx.ui.custom<unknown>((tui, theme, _keybindings, done) => {
          const dashboard = createDashboard({
            tui,
            theme,
            initialSessions,
            onRefresh: async () => readSessions(),
            onClose: () => {
              done(undefined)
            },
          })

          return {
            render: dashboard.render.bind(dashboard),
            handleInput: dashboard.handleInput.bind(dashboard),
            invalidate: dashboard.invalidate.bind(dashboard),
          }
        })

        return undefined
      },
    })
  }
}
