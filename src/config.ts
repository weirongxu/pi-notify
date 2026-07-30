import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { getAgentDir } from '@earendil-works/pi-coding-agent'

interface NotifyEventsConfig {
  readonly [channel: string]: string
}

interface NotifyConfig {
  readonly enabled?: boolean
  readonly notifyTools?: readonly string[]
  readonly events?: NotifyEventsConfig
  readonly finished?: boolean
  readonly finishedThrottleSecs?: number
  readonly onlyNotifyWhenUnfocused?: boolean
  readonly unfocusedActivityThresholdSecs?: number
  readonly tmuxSymbol?: string
}

export interface ResolvedNotifyConfig {
  readonly enabled: boolean
  readonly notifyTools: ReadonlySet<string>
  readonly events: NotifyEventsConfig
  readonly finished: boolean
  readonly finishedThrottleMs: number
  readonly onlyNotifyWhenUnfocused: boolean
  readonly unfocusedActivityThresholdMs: number
  readonly tmuxSymbol: string
}

/**
 * Default tool names that trigger notifications.
 *
 * Note: These are built-in pi tool names. If pi renames these tools, the default should be updated.
 * Source: @earendil-works/pi-coding-agent
 */
const DEFAULT_NOTIFY_TOOLS = ['ask_user', 'ask_user_question'] as const

const DEFAULT_TMUX_SYMBOL = '🔔'

const DEFAULT_EVENTS: NotifyEventsConfig = {
  'permissions:ui_prompt': 'Permission prompt',
  'git:shortcuts:result': 'Git command result',
}

const SETTINGS_PATH = join(getAgentDir(), 'settings.json')

function readRawConfig(): NotifyConfig {
  if (!existsSync(SETTINGS_PATH)) return {}
  try {
    const parsed = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8')) as {
      piNotify?: NotifyConfig
    }
    return parsed.piNotify ?? {}
  } catch {
    // Malformed settings.json must not break the agent; fall back to defaults.
    return {}
  }
}

export function loadConfig(): ResolvedNotifyConfig {
  const cfg = readRawConfig()
  const events = cfg.events ?? DEFAULT_EVENTS
  return {
    enabled: cfg.enabled ?? true,
    notifyTools: new Set(cfg.notifyTools ?? DEFAULT_NOTIFY_TOOLS),
    events,
    finished: cfg.finished ?? true,
    finishedThrottleMs: Math.max(0, (cfg.finishedThrottleSecs ?? 0) * 1000),
    onlyNotifyWhenUnfocused: cfg.onlyNotifyWhenUnfocused ?? true,
    unfocusedActivityThresholdMs: Math.max(
      0,
      (cfg.unfocusedActivityThresholdSecs ?? 30) * 1000,
    ),
    tmuxSymbol: cfg.tmuxSymbol ?? DEFAULT_TMUX_SYMBOL,
  }
}
