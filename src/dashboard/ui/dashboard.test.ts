import type { Theme, ThemeColor } from '@earendil-works/pi-coding-agent'
import { visibleWidth } from '@earendil-works/pi-tui'
import { describe, expect, it } from 'vitest'

import type { SessionRecord } from '../state-store.js'
import { Dashboard } from './dashboard.js'

const theme = {
  fg: (color: ThemeColor, text: string) => `\x1b[90m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
} as unknown as Theme

const ANSI_RE =
  // eslint-disable-next-line no-control-regex
  /\[[0-9;?]*[ -/]*[@-~]/g
const stripAnsi = (line: string): string => line.replace(ANSI_RE, '')

function makeSession(overrides: Partial<SessionRecord>): SessionRecord {
  return {
    pid: 123,
    sessionId: 'abc123',
    cwd: '/tmp',
    projectName: 'proj',
    startedAt: Date.now(),
    state: 'idle',
    ...overrides,
  }
}

function makeDashboard(sessions: SessionRecord[]) {
  return new Dashboard({
    tui: { requestRender: () => {} },
    theme,
    initialSessions: sessions,
    onRefresh: async () => sessions,
    onClose: () => {},
  })
}

describe('Dashboard render clipping', () => {
  const longNameSession = makeSession({
    projectName: 'a-very-long-project-name-that-exceeds-any-narrow-width',
  })

  it('clips every line to the terminal width at narrow widths', () => {
    const dashboard = makeDashboard([longNameSession])
    for (const line of dashboard.render(40)) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(40)
    }
    dashboard.dispose()
  })

  it('does not add ellipsis or padding at wide widths', () => {
    const dashboard = makeDashboard([longNameSession])
    for (const line of dashboard.render(200)) {
      expect(line).not.toContain('…')
      expect(line.endsWith(' ')).toBe(false)
    }
    dashboard.dispose()
  })

  it('clips the header and footer hint lines at width 20', () => {
    const dashboard = makeDashboard([makeSession({})])
    const lines = dashboard.render(20)
    const visible = lines.map(stripAnsi)
    const header = visible.find((l) => l.includes('STATE'))
    expect(header).toBeDefined()
    const footer = visible.find((l) => l.startsWith('o ids'))
    expect(footer).toBeDefined()
    if (!header || !footer) throw new Error('unreachable')
    expect(header.startsWith('STATE')).toBe(true)
    expect(header.endsWith('…')).toBe(true)
    expect(footer.startsWith('o ids • r refresh •…')).toBe(true)
    for (const line of visible) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(20)
    }
    dashboard.dispose()
  })

  it('counts CJK project names by display width', () => {
    const dashboard = makeDashboard([
      makeSession({ projectName: '中文项目名' }),
    ])
    for (const line of dashboard.render(40)) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(40)
    }
    dashboard.dispose()
  })
})

describe('hidden column toggle', () => {
  it('hides hidden columns by default and toggles with o', () => {
    const dashboard = makeDashboard([makeSession({})])
    try {
      const headerOf = () => {
        const lines = dashboard.render(200).map(stripAnsi)
        return lines.find((l) => l.includes('STATE') && l.includes('RUNNING'))
      }

      let header = headerOf()
      expect(header).toContain('STATE')
      expect(header).not.toContain('SESSION_ID')
      expect(header).not.toContain('PID')

      dashboard.handleInput('o')
      header = headerOf()
      expect(header).toContain('SESSION_ID')
      expect(header).toContain('PID')

      dashboard.handleInput('o')
      header = headerOf()
      expect(header).not.toContain('SESSION_ID')
      expect(header).not.toContain('PID')
    } finally {
      dashboard.dispose()
    }
  })
})
