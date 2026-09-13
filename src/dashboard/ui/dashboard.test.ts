import type { Theme, ThemeColor } from '@earendil-works/pi-coding-agent'
import { visibleWidth } from '@earendil-works/pi-tui'
import { describe, expect, it, vi } from 'vitest'

import type { SessionRecord } from '../state-store.js'
import { Dashboard } from './dashboard.js'

const theme = {
  fg: (color: ThemeColor, text: string) => `\x1b[90m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
  underline: (text: string) => `\x1b[4m${text}\x1b[0m`,
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

function makeDashboard(
  sessions: SessionRecord[],
  overrides: Partial<{
    onRefresh: () => Promise<SessionRecord[]>
  }> = {},
) {
  const onRefresh = overrides.onRefresh ?? (async () => sessions)
  return new Dashboard({
    tui: { requestRender: () => {} },
    theme,
    initialSessions: sessions,
    onRefresh,
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
    const footer = visible.find((l) => l.startsWith('[j/k/'))
    expect(footer).toBeDefined()
    if (!header || !footer) throw new Error('unreachable')
    expect(header.startsWith('  STATE')).toBe(true)
    expect(header.endsWith('…')).toBe(true)
    expect(footer.startsWith('[j/k/↑↓] move · [x]…')).toBe(true)
    for (const line of visible) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(20)
    }
    dashboard.dispose()
  })

  it('aligns header columns with session rows via the 2-char gutter', () => {
    const dashboard = makeDashboard([makeSession({})])
    const lines = dashboard.render(200).map(stripAnsi)
    const header = lines.find((l) => l.includes('STATE'))
    const row = lines.find((l) => l.includes('proj'))
    expect(header).toBeDefined()
    expect(row).toBeDefined()
    if (!header || !row) throw new Error('unreachable')
    expect(header.indexOf('PROJECT')).toBe(row.indexOf('proj'))
    expect(header.indexOf('STATE')).toBe(2)
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

describe('dashboard state display', () => {
  it('renders dashboard as state for the current process pid', () => {
    const dashboard = makeDashboard([
      makeSession({ pid: process.pid, state: 'idle' }),
    ])
    dashboard.handleInput('o')
    try {
      const row = dashboard
        .render(200)
        .map(stripAnsi)
        .find((l) => l.includes('abc123'))
      expect(row).toBeDefined()
      expect(row).toContain('dashboard')
      expect(row).not.toContain('idle')
    } finally {
      dashboard.dispose()
    }
  })

  it('keeps real state for other pids', () => {
    const dashboard = makeDashboard([
      makeSession({ pid: 999, state: 'running' }),
    ])
    dashboard.handleInput('o')
    try {
      const row = dashboard
        .render(200)
        .map(stripAnsi)
        .find((l) => l.includes('abc123'))
      expect(row).toBeDefined()
      expect(row).toContain('running')
      expect(row).not.toContain('dashboard')
    } finally {
      dashboard.dispose()
    }
  })
})

describe('auto-refresh', () => {
  it('manual r triggers refresh', () => {
    const onRefresh = vi.fn(async () => [makeSession({})])
    const dashboard = makeDashboard([makeSession({})], { onRefresh })
    dashboard.handleInput('r')
    expect(onRefresh).toHaveBeenCalledTimes(1)
    dashboard.dispose()
  })

  it('dispose stops further refreshes', () => {
    const onRefresh = vi.fn(async () => [makeSession({})])
    const dashboard = makeDashboard([makeSession({})], { onRefresh })
    dashboard.dispose()
    dashboard.handleInput('r')
    expect(onRefresh).not.toHaveBeenCalled()
  })
})

describe('selection navigation', () => {
  const rows = (dashboard: Dashboard) =>
    dashboard
      .render(200)
      .map(stripAnsi)
      .filter((l) => l.includes('proj'))

  it('starts with first row selected and moves with j/k and arrows', () => {
    const dashboard = makeDashboard([
      makeSession({ pid: 1, sessionId: 'abc123' }),
      makeSession({ pid: 2, sessionId: 'def456' }),
      makeSession({ pid: 3, sessionId: 'ghi789' }),
    ])
    try {
      dashboard.handleInput('o')
      let [first, second, third] = rows(dashboard)
      expect(first?.startsWith('> ')).toBe(true)
      expect(second?.startsWith('  ')).toBe(true)

      dashboard.handleInput('j')
      ;[first, second, third] = rows(dashboard)
      expect(first?.startsWith('  ')).toBe(true)
      expect(second?.startsWith('> ')).toBe(true)

      dashboard.handleInput('\x1b[B')
      ;[first, second, third] = rows(dashboard)
      expect(third?.startsWith('> ')).toBe(true)

      dashboard.handleInput('k')
      dashboard.handleInput('\x1b[A')
      ;[first, second, third] = rows(dashboard)
      expect(first?.startsWith('> ')).toBe(true)
    } finally {
      dashboard.dispose()
    }
  })

  it('clamps selection at first and last row', () => {
    const dashboard = makeDashboard([
      makeSession({ pid: 1, sessionId: 'abc123' }),
      makeSession({ pid: 2, sessionId: 'def456' }),
    ])
    try {
      dashboard.handleInput('o')
      dashboard.handleInput('k')
      expect(rows(dashboard)[0]?.startsWith('> ')).toBe(true)

      dashboard.handleInput('j')
      dashboard.handleInput('j')
      const rowsNow = rows(dashboard)
      expect(rowsNow[0]?.startsWith('  ')).toBe(true)
      expect(rowsNow[1]?.startsWith('> ')).toBe(true)
    } finally {
      dashboard.dispose()
    }
  })

  it('clamps selection to the last row after refresh shrinks the list', async () => {
    const onRefresh = vi.fn(async () => [
      makeSession({ pid: 3, sessionId: 'ghi789' }),
    ])
    const dashboard = makeDashboard(
      [
        makeSession({ pid: 1, sessionId: 'abc123' }),
        makeSession({ pid: 2, sessionId: 'def456' }),
        makeSession({ pid: 4, sessionId: 'jkl012' }),
      ],
      { onRefresh },
    )
    try {
      dashboard.handleInput('o')
      dashboard.handleInput('j')
      dashboard.handleInput('j')
      expect(rows(dashboard)[2]?.startsWith('> ')).toBe(true)

      dashboard.handleInput('r')
      await vi.waitFor(() => {
        expect(onRefresh).toHaveBeenCalled()
      })

      // selection stays on the last row (position-based), moving down must not go out of bounds
      dashboard.handleInput('j')
      const visible = rows(dashboard)
      expect(visible).toHaveLength(1)
      expect(visible[0]?.startsWith('> ')).toBe(true)
    } finally {
      dashboard.dispose()
    }
  })

  it('no-ops on empty session list', () => {
    const dashboard = makeDashboard([])
    try {
      dashboard.handleInput('j')
      dashboard.handleInput('k')
      dashboard.handleInput('x')
      expect(
        dashboard.render(200).some((l) => stripAnsi(l).startsWith('> ')),
      ).toBe(false)
    } finally {
      dashboard.dispose()
    }
  })
})

describe('kill action', () => {
  let killSpy: ReturnType<typeof vi.spyOn>

  const rows = (dashboard: Dashboard) =>
    dashboard
      .render(200)
      .map(stripAnsi)
      .filter((l) => l.includes('proj'))

  it('kills the selected session with SIGTERM', async () => {
    killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
    const onRefresh = vi.fn(async () => [
      makeSession({ pid: process.pid, sessionId: 'abc123' }),
    ])
    const dashboard = makeDashboard(
      [
        makeSession({ pid: process.pid, sessionId: 'self001' }),
        makeSession({ pid: 999, sessionId: 'target1' }),
      ],
      { onRefresh },
    )
    try {
      dashboard.handleInput('o')
      dashboard.handleInput('j')
      expect(rows(dashboard)[1]?.startsWith('> ')).toBe(true)
      dashboard.handleInput('x')
      expect(killSpy).toHaveBeenCalledWith(999, 'SIGTERM')
      await vi.waitFor(() => {
        expect(onRefresh).toHaveBeenCalled()
      })
    } finally {
      dashboard.dispose()
      killSpy.mockRestore()
    }
  })

  it('does not kill the dashboard own row', () => {
    killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
    const dashboard = makeDashboard([
      makeSession({ pid: process.pid, sessionId: 'abc123' }),
    ])
    try {
      dashboard.handleInput('x')
      expect(killSpy).not.toHaveBeenCalled()
    } finally {
      dashboard.dispose()
      killSpy.mockRestore()
    }
  })

  it('ignores ESRCH errors from kill', () => {
    killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
      throw Object.assign(new Error('no such process'), { code: 'ESRCH' })
    })
    const dashboard = makeDashboard([
      makeSession({ pid: 999, sessionId: 'abc123' }),
    ])
    try {
      expect(() => {
        dashboard.handleInput('x')
      }).not.toThrow()
    } finally {
      dashboard.dispose()
      killSpy.mockRestore()
    }
  })
})

describe('selection degradation', () => {
  it('follows the selected session as the list shrinks', async () => {
    const onRefresh = vi.fn(async () => [
      makeSession({ pid: 2, sessionId: 'bbb' }),
    ])
    const dashboard = makeDashboard(
      [
        makeSession({ pid: 1, sessionId: 'aaa' }),
        makeSession({ pid: 2, sessionId: 'bbb' }),
      ],
      { onRefresh },
    )
    try {
      // select row 0 (session 'aaa'), refresh removes it -> marker lands on 'bbb'
      dashboard.handleInput('r')
      await vi.waitFor(() => {
        expect(onRefresh).toHaveBeenCalled()
      })
      const visible = dashboard
        .render(200)
        .map(stripAnsi)
        .filter((l) => l.includes('proj'))
      expect(visible).toHaveLength(1)
      expect(visible[0]?.startsWith('> ')).toBe(true)

      // refresh to empty -> no marker; navigation/kill no-op
      const emptyRefresh = vi.fn(async () => [])
      const dashboard2 = makeDashboard(
        [makeSession({ pid: 2, sessionId: 'abc123' })],
        { onRefresh: emptyRefresh },
      )
      try {
        dashboard2.handleInput('r')
        await vi.waitFor(() => {
          expect(emptyRefresh).toHaveBeenCalled()
        })
        const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
        try {
          dashboard2.handleInput('j')
          dashboard2.handleInput('x')
          expect(
            dashboard2.render(200).some((l) => stripAnsi(l).startsWith('> ')),
          ).toBe(false)
          expect(killSpy).not.toHaveBeenCalled()
        } finally {
          killSpy.mockRestore()
        }
      } finally {
        dashboard2.dispose()
      }
    } finally {
      dashboard.dispose()
    }
  })
})
