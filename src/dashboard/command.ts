import { Registrar } from '../shared/registrar.js'
import { readSessions } from './state-store.js'
import { Dashboard } from './ui/dashboard.js'

export class DashboardCommand extends Registrar {
  protected override setup(): void {
    this.pi.registerCommand('notify-dashboard', {
      description: 'Show all pi sessions notify dashboard',
      handler: async (_args, ctx) => {
        const initialSessions = await readSessions()

        await ctx.ui.custom<unknown>((tui, theme, _keybindings, done) => {
          let closed = false
          const dashboard = new Dashboard({
            tui,
            theme,
            initialSessions,
            onRefresh: async () => readSessions(),
            onClose: () => {
              if (closed) return
              closed = true
              dashboard.dispose()
              done(undefined)
            },
          })

          return dashboard
        })

        return undefined
      },
    })
  }
}
