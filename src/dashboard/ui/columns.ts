import type { Theme } from '@earendil-works/pi-coding-agent'
import { truncateToWidth } from '@earendil-works/pi-tui'
import { sumBy } from 'lodash-es'

import type { SessionRecord } from '../state-store.js'

interface Column {
  name: string
  width?: number
  hiddenByDefault?: boolean
  render: (session: SessionRecord, theme: Theme, width: number) => string
}

const COLUMNS: Column[] = [
  {
    name: 'SESSION_ID',
    width: 10,
    hiddenByDefault: true,
    render: (session, theme, width) =>
      theme.fg('dim', session.sessionId.slice(-6).padEnd(width)),
  },
  {
    name: 'PID',
    width: 8,
    hiddenByDefault: true,
    render: (session, theme, width) =>
      theme.fg('dim', String(session.pid).padEnd(width)),
  },
  {
    name: 'STATE',
    width: 20,
    render: (session, theme, width) => {
      const isDashboard = session.pid === process.pid
      const label = isDashboard ? 'dashboard' : session.state
      const color = isDashboard
        ? 'syntaxKeyword'
        : session.state === 'running'
          ? 'success'
          : 'muted'
      return theme.fg(
        color,
        truncateToWidth(label, width, '…', true).padEnd(width),
      )
    },
  },
  {
    name: 'PROJECT',
    render: (session, theme, width) =>
      theme.fg('text', truncateToWidth(session.projectName, width, '…', true)),
  },
  {
    name: 'RUNNING',
    width: 10,
    render: (session, theme, width) => {
      const startedRunningAt = session.startedRunningAt
      if (!startedRunningAt) return ''.padEnd(width)
      const duration = Date.now() - startedRunningAt
      return theme.fg('dim', formatDuration(duration).padEnd(width))
    },
  },
  {
    name: 'UPTIME',
    width: 10,
    render: (session, theme, width) =>
      theme.fg(
        'dim',
        formatDuration(Date.now() - session.startedAt).padEnd(width),
      ),
  },
]

export const COLUMN_SEPARATOR = ' '
const MIN_PROJECT_WIDTH = 10

export interface ResolvedColumn {
  col: Column
  width: number
}

export function resolveColumns(
  totalWidth: number,
  includeHidden = true,
): ResolvedColumn[] {
  const columns = COLUMNS.filter((col) => includeHidden || !col.hiddenByDefault)
  const fixedWidth = sumBy(columns, (col) => col.width ?? 0)
  const separatorWidth = COLUMN_SEPARATOR.length * (columns.length - 1)
  const flexibleWidth = Math.max(
    MIN_PROJECT_WIDTH,
    totalWidth - fixedWidth - separatorWidth,
  )
  return columns.map((col) => ({ col, width: col.width ?? flexibleWidth }))
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    const mins = minutes % 60
    return `${hours}h${mins}m`
  }
  if (minutes > 0) {
    const secs = seconds % 60
    return `${minutes}m${secs}s`
  }
  return `${seconds}s`
}
