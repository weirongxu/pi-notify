import type { Theme } from '@earendil-works/pi-coding-agent'
import type { Component } from '@earendil-works/pi-tui'
import { Key, matchesKey, truncateToWidth } from '@earendil-works/pi-tui'
import { clamp } from 'lodash-es'

import type { SessionRecord } from '../state-store.js'
import { watchStore } from '../watch-store.js'
import {
  COLUMN_SEPARATOR,
  resolveColumns,
  type ResolvedColumn,
} from './columns.js'

export interface DashboardProps {
  tui: { requestRender: () => void }
  theme: Theme
  initialSessions: SessionRecord[]
  onRefresh: () => Promise<SessionRecord[]>
  onClose: () => void
  onDispose?: () => void
}

export class Dashboard implements Component {
  private readonly tui: DashboardProps['tui']
  private readonly theme: Theme
  private readonly onRefresh: DashboardProps['onRefresh']
  private readonly onClose: DashboardProps['onClose']
  private readonly onDispose: DashboardProps['onDispose']
  private sessions: SessionRecord[]
  private cachedWidth: number | null = null
  private cachedLines: string[] = []
  private disposed = false
  private showHidden = false
  private selectedIndex = 0
  private readonly stopWatching: () => void

  constructor({
    tui,
    theme,
    initialSessions,
    onRefresh,
    onClose,
    onDispose,
  }: DashboardProps) {
    this.tui = tui
    this.theme = theme
    this.onRefresh = onRefresh
    this.onClose = onClose
    this.onDispose = onDispose
    this.sessions = [...initialSessions]

    this.stopWatching = watchStore(() => {
      this.refresh()
    })
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

  private refresh(): void {
    if (this.disposed) return
    this.onRefresh()
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
        ['x', 'kill'],
        ['o', 'show/hide ids'],
        ['r', 'refresh'],
        ['q/esc', 'close'],
      ]),
    ]
    this.cachedLines = rows.map((line) => truncateToWidth(line, width, '…'))
    return this.cachedLines
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
    this.stopWatching()
    this.onDispose?.()
  }
}
