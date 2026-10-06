import { execFileSync } from 'node:child_process'

export type CommandRunner = (file: string, args: string[]) => string | undefined

const LIST_FORMAT = '#{pane_tty}\t#{window_id}'
const TAB = '\t'
const NEWLINE = '\n'

export const defaultRunner: CommandRunner = (file, args) => {
  try {
    return execFileSync(file, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return undefined
  }
}

const sessionTty = (pid: number, run: CommandRunner): string | undefined => {
  const out = run('ps', ['-o', 'tty=', '-p', String(pid)])
  const tty = out?.trim()
  if (!tty || tty === '?') return undefined
  return tty.startsWith('/dev/') ? tty : `/dev/${tty}`
}

const windowIdByTty = (tty: string, run: CommandRunner): string | undefined => {
  const out = run('tmux', ['list-panes', '-a', '-F', LIST_FORMAT])
  if (out === undefined) return undefined
  for (const line of out.split(NEWLINE)) {
    const [paneTty, windowId] = line.split(TAB)
    if (paneTty === tty) return windowId
  }
  return undefined
}

export function jumpToSessionTmuxWindow(
  pid: number,
  run: CommandRunner = defaultRunner,
): void {
  if (process.env.TMUX === undefined) return
  const tty = sessionTty(pid, run)
  if (tty === undefined) return
  const windowId = windowIdByTty(tty, run)
  if (windowId === undefined) return
  run('tmux', ['switch-client', '-t', windowId])
}
