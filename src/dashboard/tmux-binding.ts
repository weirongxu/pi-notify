import type { CommandRunner } from './tmux-jump.js'
import { defaultRunner } from './tmux-jump.js'

const PANE_OPTION = '@pi-notify-dashboard'
export const FALLBACK_KEY = 'M-d'

function modifierOf(part: string): string | undefined {
  if (part === 'alt') return 'M'
  if (part === 'ctrl') return 'C'
  if (part === 'shift') return 'S'
  return undefined
}

// NOTE: tmux pre-expands #{...} formats in a run-shell command when the key
// binding fires (using the pane where the key was pressed). Formats that must
// reach the inner `tmux list-panes` intact are therefore written as ##{...}
// (tmux turns ## into a literal #). The plain #{pane_id} in the elif branch is
// intentional: it is expanded at press time to the pane where the key was
// pressed, making a press inside the dashboard pane a no-op.
const JUMP_SCRIPT = [
  `p=$(tmux list-panes -a -F '##{pane_id}|##{${PANE_OPTION}}' | awk -F'|' '$2 == "1" {print $1; exit}')`,
  'if [ -z "$p" ]; then',
  "  tmux display-message 'pi-notify: dashboard is not running'",
  'elif [ "$p" = \'#{pane_id}\' ]; then',
  '  :',
  'else',
  '  tmux switch-client -t "$p"',
  'fi',
].join('\n')

export function toTmuxKey(key: string): string {
  const parts = key
    .toLowerCase()
    .split('+')
    .map((part) => part.trim())
    .filter((part) => part !== '')
  const modifiers: string[] = []
  let base: string | undefined
  for (const part of parts) {
    const modifier = modifierOf(part)
    if (modifier !== undefined) {
      modifiers.push(modifier)
    } else if (base === undefined) {
      base = part
    } else {
      return FALLBACK_KEY
    }
  }
  if (base === undefined) return FALLBACK_KEY
  if (/^[a-z]$/.test(base) && modifiers.join('') === 'S') {
    base = base.toUpperCase()
  }
  return `${modifiers.join('-')}${modifiers.length > 0 ? '-' : ''}${base}`
}

export function registerDashboardTmuxBinding(
  key: string,
  run: CommandRunner = defaultRunner,
): void {
  // Register in the prefix table (no -n flag) so the user presses prefix + key.
  run('tmux', ['bind-key', toTmuxKey(key), 'run-shell', JUMP_SCRIPT])
}

export function markDashboardTmuxPane(
  run: CommandRunner = defaultRunner,
): void {
  // Only mark the pane; never rename or lock the window name.
  run('tmux', ['set-option', '-p', PANE_OPTION, '1'])
}

export function unmarkDashboardTmuxPane(
  run: CommandRunner = defaultRunner,
): void {
  run('tmux', ['set-option', '-p', '-u', PANE_OPTION])
}
