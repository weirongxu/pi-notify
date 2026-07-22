import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { getAgentDir } from '@earendil-works/pi-coding-agent'

/** Per-event toggles, all default to enabled. */
interface NotifyEventsConfig {
  readonly permission?: boolean
  readonly finished?: boolean
}

/** Raw shape of the `piNotify` node in settings.json. */
interface NotifyConfig {
  readonly enabled?: boolean
  readonly notifyTools?: readonly string[]
  readonly events?: NotifyEventsConfig
  readonly finishedThrottleSecs?: number
  readonly onlyNotifyWhenUnfocused?: boolean
  readonly unfocusedActivityThresholdSecs?: number
}

/** Fully resolved configuration with defaults applied. */
export interface ResolvedNotifyConfig {
  readonly enabled: boolean
  readonly notifyTools: ReadonlySet<string>
  readonly permission: boolean
  readonly finished: boolean
  readonly finishedThrottleMs: number
  readonly onlyNotifyWhenUnfocused: boolean
  readonly unfocusedActivityThresholdMs: number
}

/**
 * Default tool names that trigger notifications.
 *
 * Note: These are built-in pi tool names. If pi renames these tools, the default should be updated.
 * Source: @earendil-works/pi-coding-agent
 */
const DEFAULT_NOTIFY_TOOLS = ['ask_user', 'ask_user_question'] as const

/** Global pi settings file that owns the `piNotify` node. */
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

/** Load and resolve the `piNotify` config from pi's global settings.json. */
export function loadConfig(): ResolvedNotifyConfig {
  const cfg = readRawConfig()
  const events = cfg.events ?? {}
  return {
    enabled: cfg.enabled ?? true,
    notifyTools: new Set(cfg.notifyTools ?? DEFAULT_NOTIFY_TOOLS),
    permission: events.permission ?? true,
    finished: events.finished ?? true,
    finishedThrottleMs: Math.max(0, (cfg.finishedThrottleSecs ?? 0) * 1000),
    onlyNotifyWhenUnfocused: cfg.onlyNotifyWhenUnfocused ?? true,
    unfocusedActivityThresholdMs: Math.max(
      0,
      (cfg.unfocusedActivityThresholdSecs ?? 30) * 1000,
    ),
  }
}
