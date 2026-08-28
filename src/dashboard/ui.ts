import type { Theme } from '@earendil-works/pi-coding-agent'
import { DynamicBorder } from '@earendil-works/pi-coding-agent'
import {
  Container,
  Key,
  matchesKey,
  Spacer,
  Text,
  truncateToWidth,
} from '@earendil-works/pi-tui'

import type { SessionRecord } from './state-store.js'

const COLUMNS = [
  { name: 'SESSION_ID', width: 8 },
  { name: 'PID', width: 8 },
  { name: 'STATE', width: 8 },
  { name: 'PROJECT', width: 15 },
  { name: 'UPTIME', width: 10 },
] as const

const [SESSION_ID_COL, PID_COL, STATE_COL, PROJECT_COL, UPTIME_COL] = COLUMNS

const MAX_ROWS = Math.max(1, (process.stdout.rows || 20) - 6)

export interface DashboardProps {
  tui: { requestRender: () => void }
  theme: Theme
  initialSessions: SessionRecord[]
  onRefresh: () => Promise<SessionRecord[]>
  onClose: () => void
  onDispose?: () => void
}

function formatUptime(startedAt: number): string {
  const elapsed = Date.now() - startedAt
  const seconds = Math.floor(elapsed / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }
  if (minutes > 0) {
    const secs = seconds % 60
    return `${minutes}m ${secs}s`
  }
  return `${seconds}s`
}

export function createDashboard(props: DashboardProps) {
  let sessions = [...props.initialSessions]
  let scrollOffset = 0
  let cachedWidth: number | null = null
  let cachedLines: string[] = []
  let disposed = false

  const dashboardContainer = new Container()

  function refresh(): void {
    props
      .onRefresh()
      .then((newSessions) => {
        sessions = [...newSessions]
        scrollOffset = 0
        cachedWidth = null
        props.tui.requestRender()
      })
      .catch(() => {})
  }

  const timer = setInterval(() => {
    if (!disposed) refresh()
  }, 1000)

  function updateChildren(): void {
    const { theme } = props

    const stats = sessions.reduce(
      (acc, s) => {
        acc[s.state]++
        return acc
      },
      { running: 0, idle: 0 },
    )

    const headerLine = COLUMNS.map((col) => col.name.padEnd(col.width)).join(
      '  ',
    )

    dashboardContainer.clear()
    dashboardContainer.addChild(
      new Text(
        `${theme.fg('accent', theme.bold('pi sessions dashboard'))} ${theme.fg(
          'dim',
          `total=${sessions.length} running=${stats.running} idle=${stats.idle}`,
        )}`,
        0,
        0,
      ),
    )
    dashboardContainer.addChild(new Spacer(1))
    dashboardContainer.addChild(
      new Text(theme.fg('borderAccent', headerLine), 0, 0),
    )
    dashboardContainer.addChild(
      new DynamicBorder((str) => theme.fg('borderAccent', str)),
    )

    for (const session of sessions.slice(
      scrollOffset,
      scrollOffset + MAX_ROWS,
    )) {
      const stateColor = session.state === 'running' ? 'success' : 'muted'
      const line = [
        theme.fg(
          'dim',
          session.sessionId.slice(-6).padEnd(SESSION_ID_COL.width),
        ),
        theme.fg('dim', String(session.pid).padEnd(PID_COL.width)),
        theme.fg(stateColor, session.state.padEnd(STATE_COL.width)),
        theme.fg(
          'text',
          truncateToWidth(session.projectName, PROJECT_COL.width, '…', true),
        ),
        theme.fg(
          'dim',
          formatUptime(session.stateChangedAt).padEnd(UPTIME_COL.width),
        ),
      ].join('  ')
      dashboardContainer.addChild(new Text(line, 0, 0))
    }

    dashboardContainer.addChild(new Spacer(1))
    dashboardContainer.addChild(
      new Text(theme.fg('dim', '↑↓ scroll • r refresh • q or esc close'), 0, 0),
    )
  }

  const component = {
    render(width: number): string[] {
      if (cachedWidth !== width) {
        updateChildren()
        cachedLines = dashboardContainer.render(width)
        cachedWidth = width
      }
      return cachedLines
    },

    handleInput(data: string): void {
      if (matchesKey(data, 'r')) {
        refresh()
        return
      }

      if (matchesKey(data, 'q') || matchesKey(data, Key.escape)) {
        props.onClose()
        return
      }

      if (matchesKey(data, Key.up) || matchesKey(data, 'k')) {
        if (scrollOffset > 0) {
          scrollOffset--
          cachedWidth = null
          props.tui.requestRender()
        }
        return
      }

      if (matchesKey(data, Key.down) || matchesKey(data, 'j')) {
        if (scrollOffset + MAX_ROWS < sessions.length) {
          scrollOffset++
          cachedWidth = null
          props.tui.requestRender()
        }
      }
    },

    invalidate(): void {
      cachedWidth = null
      dashboardContainer.invalidate()
    },

    dispose(): void {
      disposed = true
      clearInterval(timer)
      props.onDispose?.()
    },
  }

  return component
}
