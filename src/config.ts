import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { getAgentDir } from '@earendil-works/pi-coding-agent'

/** Per-event toggles, all default to enabled. */
interface NotifyEventsConfig {
  readonly ask?: boolean
  readonly permission?: boolean
  readonly finished?: boolean
}

/** Raw shape of the `piNotify` node in settings.json. */
interface NotifyConfig {
  readonly enabled?: boolean
  readonly askTools?: readonly string[]
  readonly events?: NotifyEventsConfig
  readonly finishedThrottleSecs?: number
}

/** Fully resolved configuration with defaults applied. */
export interface ResolvedNotifyConfig {
  readonly enabled: boolean
  readonly askTools: ReadonlySet<string>
  readonly ask: boolean
  readonly permission: boolean
  readonly finished: boolean
  readonly finishedThrottleMs: number
}

const DEFAULT_ASK_TOOLS = ['ask_user_question'] as const

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
    askTools: new Set(cfg.askTools ?? DEFAULT_ASK_TOOLS),
    ask: events.ask ?? true,
    permission: events.permission ?? true,
    finished: events.finished ?? true,
    finishedThrottleMs: Math.max(0, (cfg.finishedThrottleSecs ?? 0) * 1000),
  }
}
