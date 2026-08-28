import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

import { getAgentDir } from '@earendil-works/pi-coding-agent'
import lockfile from 'proper-lockfile'

const ESRCH = 'ESRCH'
const EPERM = 'EPERM'

export function isProcessAlive(pid: number): boolean {
  if (pid <= 0) return false
  if (pid === process.pid) return true

  try {
    process.kill(pid, 0)
    return true
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err) {
      const code = (err as { code: string }).code
      if (code === EPERM) return true
      if (code === ESRCH) return false
    }
    return false
  }
}

export async function readSessions(): Promise<SessionRecord[]> {
  const state = readState()
  const deadIds: string[] = []
  const alive: SessionRecord[] = []

  for (const session of Object.values(state.sessions)) {
    if (!session) continue
    if (isProcessAlive(session.pid)) {
      alive.push(session)
    } else {
      deadIds.push(String(session.pid))
    }
  }

  if (deadIds.length === 0) return alive

  await updateState((s) => {
    const sessions: typeof s.sessions = {}
    for (const key of Object.keys(s.sessions)) {
      if (!deadIds.includes(key)) {
        sessions[key] = s.sessions[key]
      }
    }
    return { ...s, sessions }
  })

  return alive
}

export interface SessionRecord {
  pid: number
  sessionId: string
  cwd: string
  projectName: string
  startedAt: number
  state: 'running' | 'idle'
  stateChangedAt: number
}

export interface DashboardState {
  version: 1
  sessions: Record<string, SessionRecord | undefined>
}

const STATE_FILE = join(getAgentDir(), 'pi-notify', 'state.json')
const LOCK_RETRY_INTERVAL_MS = 50
const LOCK_MAX_RETRIES = 20

function ensureStateDir(): void {
  const dir = dirname(STATE_FILE)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

export function readState(): DashboardState {
  if (!existsSync(STATE_FILE)) {
    return { version: 1, sessions: {} }
  }

  try {
    const data = readFileSync(STATE_FILE, 'utf8')
    return JSON.parse(data) as DashboardState
  } catch {
    return { version: 1, sessions: {} }
  }
}

export async function updateState(
  mutator: (state: DashboardState) => DashboardState,
): Promise<void> {
  ensureStateDir()

  const release = await lockfile.lock(STATE_FILE, {
    realpath: false,
    stale: 30000,
    retries: {
      minTimeout: LOCK_RETRY_INTERVAL_MS,
      maxTimeout: LOCK_RETRY_INTERVAL_MS,
      retries: LOCK_MAX_RETRIES,
    },
  })

  try {
    const state = readState()
    const newState = mutator(state)
    const tmpFile = `${STATE_FILE}.tmp`
    writeFileSync(tmpFile, JSON.stringify(newState, null, 2), 'utf8')
    renameSync(tmpFile, STATE_FILE)
  } finally {
    await release()
  }
}
