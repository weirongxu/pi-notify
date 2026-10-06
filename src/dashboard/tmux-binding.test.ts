import { describe, expect, it } from 'vitest'

import { DEFAULT_DASHBOARD_TMUX_KEY } from '../config.js'
import {
  FALLBACK_KEY,
  markDashboardTmuxPane,
  registerDashboardTmuxBinding,
  toTmuxKey,
  unmarkDashboardTmuxPane,
} from './tmux-binding.js'
import type { CommandRunner } from './tmux-jump.js'

describe('toTmuxKey', () => {
  it.each([
    ['alt+d', 'M-d'],
    ['ctrl+d', 'C-d'],
    ['shift+d', 'S-D'],
    ['alt+shift+d', 'M-S-d'],
    ['ctrl+alt+f5', 'C-M-f5'],
    ['d', 'd'],
    ['f1', 'f1'],
    ['space', 'space'],
    ['enter', 'enter'],
    ['escape', 'escape'],
    ['1', '1'],
    ['=', '='],
    ['', 'M-d'],
    ['alt+', 'M-d'],
    ['d+alt+x', 'M-d'],
  ])('translates %s to %s', (input, expected) => {
    expect(toTmuxKey(input)).toBe(expected)
  })

  it('maps the default dashboard key to the tmux fallback key', () => {
    expect(toTmuxKey(DEFAULT_DASHBOARD_TMUX_KEY)).toBe(FALLBACK_KEY)
  })
})

function makeRunner(): {
  calls: { file: string; args: string[] }[]
  run: CommandRunner
} {
  const calls: { file: string; args: string[] }[] = []
  const run: CommandRunner = (file, args) => {
    calls.push({ file, args })
    return ''
  }
  return { calls, run }
}

describe('tmux pane marking and binding', () => {
  it('marks the pane without touching the window name', () => {
    const { calls, run } = makeRunner()
    markDashboardTmuxPane(run)
    expect(calls).toEqual([
      { file: 'tmux', args: ['set-option', '-p', '@pi-notify-dashboard', '1'] },
    ])
  })

  it('unmarks the pane without unbinding', () => {
    const { calls, run } = makeRunner()
    unmarkDashboardTmuxPane(run)
    expect(calls).toEqual([
      {
        file: 'tmux',
        args: ['set-option', '-p', '-u', '@pi-notify-dashboard'],
      },
    ])
  })

  it('registers the jump script in the prefix table with escaped formats', () => {
    const { calls, run } = makeRunner()
    registerDashboardTmuxBinding('alt+shift+d', run)
    expect(calls).toHaveLength(1)
    const [firstCall] = calls
    if (firstCall === undefined) return
    const { args } = firstCall
    expect(args[0]).toBe('bind-key')
    // No -n flag: the binding must live in the prefix table.
    expect(args).not.toContain('-n')
    expect(args[1]).toBe('M-S-d')
    expect(args[2]).toBe('run-shell')
    const script = args[3] ?? ''
    expect(script).toBe(
      [
        `p=$(tmux list-panes -a -F '##{pane_id}|##{@pi-notify-dashboard}' | awk -F'|' '$2 == "1" {print $1; exit}')`,
        'if [ -z "$p" ]; then',
        "  tmux display-message 'pi-notify: dashboard is not running'",
        'elif [ "$p" = \'#{pane_id}\' ]; then',
        '  :',
        'else',
        '  tmux switch-client -t "$p"',
        'fi',
      ].join('\n'),
    )
  })
})
