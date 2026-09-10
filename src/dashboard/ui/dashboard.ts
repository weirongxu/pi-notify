import type { Theme } from '@earendil-works/pi-coding-agent'
import type { Component } from '@earendil-works/pi-tui'
import { Key, matchesKey, truncateToWidth } from '@earendil-works/pi-tui'

import type { SessionRecord } from '../state-store.js'
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
  private timer: NodeJS.Timeout

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

    // FIXME: 改成用 fs.watch
    this.timer = setInterval(() => {
      if (!this.disposed) this.refresh()
    }, 10000)
  }

  private forceRender(): void {
    this.cachedWidth = null
    this.tui.requestRender()
  }

  private refresh(): void {
    this.onRefresh()
      .then((newSessions) => {
        this.sessions = [...newSessions]
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
    const columns = resolveColumns(width, this.showHidden)
    const rows = [
      this.theme.fg('borderAccent', this.headerLine(columns)),
      this.theme.fg('borderAccent', '─'.repeat(Math.max(1, width))),
      ...this.sessions.map((session) =>
        columns
          .map(({ col, width }) => col.render(session, this.theme, width))
          .join(COLUMN_SEPARATOR),
      ),
      '',
      this.footerLine(width, [
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
    clearInterval(this.timer)
    this.onDispose?.()
  }
}
