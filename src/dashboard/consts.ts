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

export type ActivityState =
  `${(typeof ACTIVITY_STATE_PREFIXES)[number]}${string}`

export function isActivityState(value: string): value is ActivityState {
  return ACTIVITY_STATE_PREFIXES.some((prefix) => value.startsWith(prefix))
}
