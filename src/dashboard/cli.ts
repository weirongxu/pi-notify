// Standalone dashboard CLI run via tsx as a separate process from the host.
// Importing pi-coding-agent (e.g. getAgentDir) is fine; it must not touch the running host instance.
import process from 'node:process'

import {
  matchesKey,
  ProcessTerminal,
  TuiAltScreen,
} from '@earendil-works/pi-tui'

import { readSessions } from './state-store.js'
import { Dashboard } from './ui/dashboard.js'
import { createTheme } from './ui/theme.js'
import { watchStore } from './watch-store.js'

async function main(): Promise<void> {
  const terminal = new ProcessTerminal()
  const tui = new TuiAltScreen(terminal)
  const theme = createTheme()

  let quitting = false
  const initialSessions = await readSessions()
  const dashboard = new Dashboard({
    tui: {
      requestRender: () => {
        tui.requestRender()
      },
    },
    theme,
    initialSessions,
    loadSessions: () => readSessions(),
    onClose: () => void quit(),
  })

  tui.setLayoutRoot(dashboard)
  tui.start()
  tui.setFocus(dashboard)

  const refresh = (): void => {
    if (quitting) return
    dashboard.refresh()
  }

  const stopWatching = watchStore(refresh)
  const tickTimer = setInterval(() => {
    if (!quitting) dashboard.tick()
  }, 1000)
  tickTimer.unref()

  async function quit(): Promise<void> {
    if (quitting) return
    quitting = true
    clearInterval(tickTimer)
    stopWatching()
    dashboard.dispose()
    tui.stop()
    try {
      await terminal.drainInput()
    } finally {
      process.exit(0)
    }
  }

  // Ctrl+C in raw mode arrives as regular input, not SIGINT.
  tui.addInputListener((data) => {
    if (matchesKey(data, 'ctrl+c')) {
      void quit()
      return { consume: true }
    }
    return undefined
  })

  const onSignal = (): void => {
    void quit()
  }
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
