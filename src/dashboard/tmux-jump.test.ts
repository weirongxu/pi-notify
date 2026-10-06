import { describe, expect, it } from 'vitest'

import type { CommandRunner } from './tmux-jump.js'
import { jumpToSessionTmuxWindow } from './tmux-jump.js'

const PANES = ['/dev/pts/0\t@0', '/dev/pts/3\t@5', '/dev/pts/7\t@2', ''].join(
  '\n',
)

function makeRunner(overrides: Record<string, string | undefined>) {
  const calls: { file: string; args: string[] }[] = []
  const run: CommandRunner = (file, args) => {
    calls.push({ file, args })
    return overrides[`${file} ${args.join(' ')}`]
  }
  return { calls, run }
}

const withTmuxEnv = async (fn: () => void | Promise<void>) => {
  const previous = process.env.TMUX
  process.env.TMUX = '/tmp/tmux-1000/default,123,0'
  try {
    await fn()
  } finally {
    if (previous === undefined) delete process.env.TMUX
    else process.env.TMUX = previous
  }
}

describe('jumpToSessionTmuxWindow', () => {
  it('queries the session tty and switches to the matching window', async () => {
    await withTmuxEnv(() => {
      const { calls, run } = makeRunner({
        'ps -o tty= -p 999': 'pts/3\n',
        'tmux list-panes -a -F #{pane_tty}\t#{window_id}': PANES,
      })
      jumpToSessionTmuxWindow(999, run)
      expect(calls).toEqual([
        { file: 'ps', args: ['-o', 'tty=', '-p', '999'] },
        {
          file: 'tmux',
          args: ['list-panes', '-a', '-F', '#{pane_tty}\t#{window_id}'],
        },
        { file: 'tmux', args: ['switch-client', '-t', '@5'] },
      ])
    })
  })

  it('does nothing when TMUX env is unset', () => {
    delete process.env.TMUX
    const { calls, run } = makeRunner({})
    jumpToSessionTmuxWindow(999, run)
    expect(calls).toEqual([])
  })

  it.each([
    ['no tty output', undefined],
    ['empty tty output', ''],
    ['detached tty', '?'],
  ])('does nothing on %s', async (_name, psValue) => {
    await withTmuxEnv(() => {
      const { calls, run } = makeRunner({ 'ps -o tty= -p 999': psValue })
      jumpToSessionTmuxWindow(999, run)
      expect(calls).toHaveLength(1)
    })
  })

  it('does nothing when no pane matches the tty', async () => {
    await withTmuxEnv(() => {
      const { calls, run } = makeRunner({
        'ps -o tty= -p 999': '/dev/pts/9',
        'tmux list-panes -a -F #{pane_tty}\t#{window_id}': PANES,
      })
      jumpToSessionTmuxWindow(999, run)
      expect(calls).toHaveLength(2)
    })
  })

  it('does not double-prefix an already absolute tty from ps', async () => {
    await withTmuxEnv(() => {
      const { calls, run } = makeRunner({
        'ps -o tty= -p 999': '/dev/pts/3',
        'tmux list-panes -a -F #{pane_tty}\t#{window_id}': PANES,
      })
      jumpToSessionTmuxWindow(999, run)
      expect(calls).toEqual([
        { file: 'ps', args: ['-o', 'tty=', '-p', '999'] },
        {
          file: 'tmux',
          args: ['list-panes', '-a', '-F', '#{pane_tty}\t#{window_id}'],
        },
        { file: 'tmux', args: ['switch-client', '-t', '@5'] },
      ])
    })
  })

  it('does not throw when switch-client fails', async () => {
    await withTmuxEnv(() => {
      const { calls, run } = makeRunner({
        'ps -o tty= -p 999': '/dev/pts/3',
        'tmux list-panes -a -F #{pane_tty}\t#{window_id}': PANES,
      })
      expect(() => {
        jumpToSessionTmuxWindow(999, run)
      }).not.toThrow()
      expect(calls).toHaveLength(3)
    })
  })

  it('does nothing when a command fails', async () => {
    await withTmuxEnv(() => {
      const { calls, run } = makeRunner({})
      jumpToSessionTmuxWindow(999, run)
      expect(calls).toHaveLength(1)

      const failing = makeRunner({
        'ps -o tty= -p 999': '/dev/pts/3',
      })
      jumpToSessionTmuxWindow(999, failing.run)
      expect(failing.calls).toHaveLength(2)
    })
  })
})
