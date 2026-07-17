import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

import { loadConfig, type ResolvedNotifyConfig } from './config.js'
import { notify } from './notifier.js'

/**
 * Broadcast by `@gotgenes/pi-permission-system` immediately before it shows the
 * approval UI. Soft dependency: only fires when that package is installed.
 */
const PERMISSIONS_UI_PROMPT_CHANNEL = 'permissions:ui_prompt'

/** Defensive view of the permission ui_prompt payload (read by notification consumers). */
interface PermissionUiPromptPayload {
  readonly surface: string | null
  readonly value: string | null
  readonly message: string | null
}

export default function piNotifyExtension(pi: ExtensionAPI): void {
  const config = loadConfig()

  let agentStartedAt: number | undefined
  let unsubscribePermission: (() => void) | undefined

  pi.on('session_start', (_event, ctx) => {
    // Permission prompts are UI-bound: only a UI-bearing session can act on one,
    // so subscribing here both matches semantics and dedupes subagent children.
    if (!config.enabled || !config.permission || !ctx.hasUI) return
    unsubscribePermission = pi.events.on(
      PERMISSIONS_UI_PROMPT_CHANNEL,
      (data: unknown) => {
        const event = data as PermissionUiPromptPayload
        const detail =
          event.message ??
          `Permission needed: ${event.surface ?? 'action'}${event.value ? ` — ${event.value}` : ''}`
        notify(config.title, detail)
      },
    )
  })

  pi.on('session_shutdown', () => {
    unsubscribePermission?.()
    unsubscribePermission = undefined
  })

  pi.on('agent_start', () => {
    agentStartedAt = Date.now()
  })

  pi.on('tool_call', (event) => {
    if (!config.enabled || !config.ask) return
    if (!config.askTools.has(event.toolName)) return
    notify(config.title, 'Pi has a question for you')
  })

  pi.on('agent_settled', () => {
    if (!config.enabled || !config.finished) return
    if (shouldThrottleFinished(config, agentStartedAt)) return
    agentStartedAt = undefined
    notify(config.title, 'Ready for input')
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
