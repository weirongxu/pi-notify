import { join } from 'node:path'

import { getAgentDir } from '@earendil-works/pi-coding-agent'

export const STATE_FILE = join(getAgentDir(), 'pi-notify', 'state.json')
export const STATE_TMP_FILE = `${STATE_FILE}.tmp`

const ACTIVITY_STATE_PREFIXES = [
  'tool_call:',
  'event:',
  'ui:',
  'notify:',
] as const

type ActivityStatePrefix = (typeof ACTIVITY_STATE_PREFIXES)[number]

const BASE_STATES = ['running', 'idle'] as const

export type SessionState =
  (typeof BASE_STATES)[number] | `${ActivityStatePrefix}${string}`

export function isSessionState(value: unknown): value is SessionState {
  if (typeof value !== 'string') return false
  return (
    BASE_STATES.some((state) => value === state) ||
    ACTIVITY_STATE_PREFIXES.some((prefix) => value.startsWith(prefix))
  )
}
