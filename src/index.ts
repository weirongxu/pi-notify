import { basename } from 'node:path'

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

import { loadConfig, type ResolvedNotifyConfig } from './config.js'
import { notify } from './notifier.js'

/**
 * Broadcast by `@gotgenes/pi-permission-system` immediately before it shows the
 * approval UI. Soft dependency: only fires when that package is installed.
 *
 * Note: This string is not exported by pi-permission-system, so it's duplicated here.
 * If the channel name changes in the upstream package, this should be updated.
 * Source: https://github.com/gotgenes/pi-packages (pi-permission-system package)
 */
const PERMISSIONS_UI_PROMPT_CHANNEL = 'permissions:ui_prompt'

export default function piNotifyExtension(pi: ExtensionAPI): void {
  const config = loadConfig()
  const dirName = basename(process.cwd())
  const title = `pi — ${dirName}`

  let agentStartedAt: number | undefined
  let unsubscribePermission: (() => void) | undefined
  let unsubscribeTerminalInput: (() => void) | undefined
  let lastUserActivityAt: number = Date.now()

  pi.on('session_start', (_event, ctx) => {
    // Track user activity for focus detection (TUI mode only)
    // This is independent of individual event settings (ask/permission/finished)
    if (
      config.enabled &&
      config.onlyNotifyWhenUnfocused &&
      ctx.mode === 'tui'
    ) {
      lastUserActivityAt = Date.now()
      unsubscribeTerminalInput = ctx.ui.onTerminalInput(() => {
        lastUserActivityAt = Date.now()
        // Return undefined to let input pass through normally
        return undefined
      })
    }

    // Permission prompts are UI-bound: only a UI-bearing session can act on one,
    // so subscribing here both matches semantics and dedupes subagent children.
    if (config.enabled && config.permission && ctx.hasUI) {
      unsubscribePermission = pi.events.on(
        PERMISSIONS_UI_PROMPT_CHANNEL,
        () => {
          if (shouldNotify(config, lastUserActivityAt)) {
            notify(title, 'Permission prompt')
          }
        },
      )
    }
  })

  pi.on('session_shutdown', () => {
    unsubscribePermission?.()
    unsubscribePermission = undefined
    unsubscribeTerminalInput?.()
    unsubscribeTerminalInput = undefined
  })

  pi.on('agent_start', () => {
    agentStartedAt = Date.now()
  })

  pi.on('tool_call', (event) => {
    if (!config.enabled) return
    if (!config.notifyTools.has(event.toolName)) return
    if (!shouldNotify(config, lastUserActivityAt)) return
    notify(title, `Tool call: ${event.toolName}`)
  })

  pi.on('agent_settled', () => {
    if (!config.enabled || !config.finished) return
    if (shouldThrottleFinished(config, agentStartedAt)) return
    agentStartedAt = undefined
    if (!shouldNotify(config, lastUserActivityAt)) return
    notify(title, 'Ready for input')
  })
}

/** Skip the finished notification when the run was shorter than the threshold. */
function shouldThrottleFinished(
  config: ResolvedNotifyConfig,
  startedAt: number | undefined,
): boolean {
  if (config.finishedThrottleMs <= 0 || startedAt === undefined) return false
  return Date.now() - startedAt < config.finishedThrottleMs
}

/** Check if notification should be sent based on user focus/activity. */
function shouldNotify(
  config: ResolvedNotifyConfig,
  lastActivityAt: number,
): boolean {
  if (!config.onlyNotifyWhenUnfocused) return true
  // If configured, only notify when user has been inactive for longer than threshold
  return Date.now() - lastActivityAt > config.unfocusedActivityThresholdMs
}
