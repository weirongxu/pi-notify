import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import type { Component } from '@earendil-works/pi-tui'

import { Registrar } from '../shared/registrar.js'

const EMPTY_COMPONENT: Component = {
  render: () => [],
  invalidate: () => {},
}

function resolveCliPath(): string {
  return fileURLToPath(new URL('./cli.ts', import.meta.url))
}

function buildSpawnArgs(): string[] {
  return [fileURLToPath(import.meta.resolve('tsx/cli')), resolveCliPath()]
}

function spawnDashboard(): Promise<void> {
  return new Promise((resolve) => {
    let spawnError: unknown
    const child = spawn(process.execPath, buildSpawnArgs(), {
      stdio: 'inherit',
      env: {
        ...process.env,
        PI_NOTIFY_DASHBOARD_PID: String(process.pid),
      },
    })
    // 'error' is always followed by 'close'; resolve only on 'close'.
    child.on('error', (err) => {
      spawnError = err
    })
    child.on('close', () => {
      if (spawnError !== undefined) {
        console.error('Failed to spawn dashboard:', spawnError)
      }
      resolve()
    })
  })
}

export class DashboardCommand extends Registrar {
  protected override setup(): void {
    this.pi.registerCommand('notify-dashboard', {
      description: 'Show all pi sessions notify dashboard',
      handler: async (_args, ctx) => {
        if (!ctx.hasUI || ctx.mode !== 'tui') {
          ctx.ui.notify('Dashboard requires the pi TUI mode', 'warning')
          return undefined
        }
        await ctx.ui.custom<unknown>((tui, _theme, _keybindings, done) => {
          tui.stop()
          void spawnDashboard().then(() => {
            tui.start()
            tui.requestRender(true)
            done(undefined)
          })
          return EMPTY_COMPONENT
        })

        return undefined
      },
    })
  }
}
