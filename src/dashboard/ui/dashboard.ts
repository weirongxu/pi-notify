import type { Component } from '@earendil-works/pi-tui'
import { Key, matchesKey, truncateToWidth } from '@earendil-works/pi-tui'
import { clamp } from 'lodash-es'

import type { SessionRecord } from '../state-store.js'
import { jumpToSessionTmuxWindow } from '../tmux-jump.js'
import {
  COLUMN_SEPARATOR,
  resolveColumns,
  type ResolvedColumn,
} from './columns.js'
import type { Theme } from './theme.js'

export interface DashboardProps {
  tui: { requestRender: () => void }
  theme: Theme
  initialSessions: SessionRecord[]
  loadSessions: () => Promise<SessionRecord[]>
  onClose: () => void
  onDispose?: () => void
}

export class Dashboard implements Component {
  private readonly tui: DashboardProps['tui']
  private readonly theme: Theme
  private readonly loadSessions: DashboardProps['loadSessions']
  private readonly onClose: DashboardProps['onClose']
  private readonly onDispose: DashboardProps['onDispose']
  private sessions: SessionRecord[]
  private cachedWidth: number | null = null
  private cachedLines: string[] = []
  private disposed = false
  private showHidden = false
  private selectedIndex = 0

  constructor({
    tui,
    theme,
    initialSessions,
    loadSessions,
    onClose,
    onDispose,
  }: DashboardProps) {
    this.tui = tui
    this.theme = theme
    this.loadSessions = loadSessions
    this.onClose = onClose
    this.onDispose = onDispose
    this.sessions = [...initialSessions]
  }

  private forceRender(): void {
    this.cachedWidth = null
    this.tui.requestRender()
  }

  private clampSelection(): void {
    if (this.sessions.length === 0) return
    this.selectedIndex = clamp(this.selectedIndex, 0, this.sessions.length - 1)
  }

  private moveSelection(delta: 1 | -1): void {
    if (this.sessions.length === 0) return
    this.selectedIndex += delta
    this.clampSelection()
    this.forceRender()
  }

  private killSelected(): void {
    const session = this.sessions[this.selectedIndex]
    if (!session || session.pid === process.pid) return
    try {
      process.kill(session.pid, 'SIGTERM')
    } catch {
      // ignore ESRCH etc.
    }
    this.refresh()
  }

  tick(): void {
    if (this.disposed) return
    this.forceRender()
  }

  refresh(): void {
    if (this.disposed) return
    this.loadSessions()
      .then((newSessions) => {
        if (this.disposed) return
        this.sessions = [...newSessions]
        this.clampSelection()
        this.forceRender()
      })
      .catch(() => {})
  }

  private headerLine(columns: ResolvedColumn[]): string {
    return columns
      .map(({ col, width }) => col.name.padEnd(width))
      .join(COLUMN_SEPARATOR)
  }

  render(width: number): string[] {
    if (this.cachedWidth === width) {
      return this.cachedLines
    }
    this.cachedWidth = width
    const tableWidth = width - 2
    const columns = resolveColumns(tableWidth, this.showHidden)
    const rows = [
      this.summaryLine(width),
      '',
      this.theme.fg('borderAccent', `  ${this.headerLine(columns)}`),
      this.theme.fg('borderAccent', `  ${'─'.repeat(Math.max(1, tableWidth))}`),
      ...this.sessions.map((session, index) => {
        const row = columns
          .map(({ col, width }) => col.render(session, this.theme, width))
          .join(COLUMN_SEPARATOR)
        const selected = index === this.selectedIndex
        const gutter = selected ? '> ' : '  '
        const styledRow = selected ? this.theme.underline(row) : row
        return gutter + styledRow
      }),
      '',
      this.footerLine(width, [
        ['j/k/↑↓', 'move'],
        ['enter', 'jump'],
        ['x', 'kill'],
        ['o', 'show/hide ids'],
        ['r', 'refresh'],
        ['q/esc', 'close'],
      ]),
    ]
    this.cachedLines = rows.map((line) => truncateToWidth(line, width, '…'))
    return this.cachedLines
  }

  private summaryLine(width: number): string {
    const total = this.sessions.length
    // Only base 'running' counts; activity-prefixed states are recent-activity markers.
    const running = this.sessions.filter((s) => s.state === 'running').length
    const idle = total - running
    const sep = this.theme.fg('dim', ' · ')
    return truncateToWidth(
      [
        `total ${this.theme.fg('text', String(total))}`,
        `running ${this.theme.fg('success', String(running))}`,
        `idle ${this.theme.fg('muted', String(idle))}`,
      ].join(sep),
      width,
      '…',
    )
  }

  private footerLine(width: number, keys: [string, string][]): string {
    const sep = this.theme.fg('dim', ' · ')
    return truncateToWidth(
      keys
        .map(
          ([key, desc]) =>
            `${this.theme.fg('syntaxKeyword', `[${key}]`)} ${this.theme.fg('success', desc)}`,
        )
        .join(sep),
      width,
      '…',
    )
  }

  handleInput(data: string): void {
    if (matchesKey(data, 'j') || matchesKey(data, Key.down)) {
      this.moveSelection(1)
      return
    }

    if (matchesKey(data, 'k') || matchesKey(data, Key.up)) {
      this.moveSelection(-1)
      return
    }

    if (matchesKey(data, 'x')) {
      this.killSelected()
      return
    }

    if (matchesKey(data, 'r')) {
      this.refresh()
      return
    }

    if (matchesKey(data, Key.enter)) {
      const session = this.sessions[this.selectedIndex]
      if (session) jumpToSessionTmuxWindow(session.pid)
      return
    }

    if (matchesKey(data, 'q') || matchesKey(data, Key.escape)) {
      this.onClose()
      return
    }

    if (matchesKey(data, 'o')) {
      this.showHidden = !this.showHidden
      this.forceRender()
    }
  }

  invalidate(): void {
    this.cachedWidth = null
  }

  dispose(): void {
    this.disposed = true
    this.onDispose?.()
  }
}
