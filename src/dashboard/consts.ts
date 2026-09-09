import { join } from 'node:path'

import { getAgentDir } from '@earendil-works/pi-coding-agent'

export const STATE_FILE = join(getAgentDir(), 'pi-notify', 'state.json')
export const STATE_TMP_FILE = `${STATE_FILE}.tmp`
