import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { getAgentDir } from '@earendil-works/pi-coding-agent'

// `false` disables the event
interface NotifyEventsConfig {
  readonly [channel: string]: string | false
}

interface NotifyConfig {
  readonly enabled?: boolean
  readonly notifyTools?: readonly string[]
  readonly events?: NotifyEventsConfig
  readonly finished?: boolean
  readonly onlyNotifyWhenUnfocused?: boolean
  readonly unfocusedActivityThresholdSecs?: number
  readonly tmuxSymbol?: string
}

export interface ResolvedNotifyConfig {
  readonly enabled: boolean
  readonly notifyTools: ReadonlySet<string>
  readonly events: NotifyEventsConfig
  readonly finished: boolean
  readonly onlyNotifyWhenUnfocused: boolean
  readonly unfocusedActivityThresholdMs: number
  readonly tmuxSymbol: string
}

const DEFAULT_TMUX_SYMBOL = '🔔'

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
  return {
    enabled: cfg.enabled ?? true,
    notifyTools: new Set(cfg.notifyTools ?? []),
    events: cfg.events ?? {},
    finished: cfg.finished ?? true,
    onlyNotifyWhenUnfocused: cfg.onlyNotifyWhenUnfocused ?? true,
    unfocusedActivityThresholdMs: Math.max(
      0,
      (cfg.unfocusedActivityThresholdSecs ?? 30) * 1000,
    ),
    tmuxSymbol: cfg.tmuxSymbol ?? DEFAULT_TMUX_SYMBOL,
  }
}
