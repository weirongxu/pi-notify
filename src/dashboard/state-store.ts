import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { dirname } from 'node:path'

import { omit, partition } from 'lodash-es'
import lockfile from 'proper-lockfile'

import { STATE_FILE, STATE_TMP_FILE } from './consts.js'

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
  const sessions = Object.values(state.sessions).filter(
    (session): session is SessionRecord => session !== undefined,
  )
  const [alive, dead] = partition(sessions, (session) =>
    isProcessAlive(session.pid),
  )

  const deadIds = dead.map((session) => String(session.pid))

  if (deadIds.length === 0) return alive

  await updateState((s) => {
    const sessions: typeof s.sessions = omit(s.sessions, deadIds)
    return { ...s, sessions }
  })

  return alive
}

export type SessionState =
  'running' | 'idle' | `tool_call:${string}` | `event:${string}`

export interface SessionRecord {
  pid: number
  sessionId: string
  cwd: string
  projectName: string
  startedAt: number
  state: SessionState
  startedRunningAt?: number
}

export interface DashboardState {
  version: 2
  sessions: Record<string, SessionRecord | undefined>
}

const LOCK_RETRY_INTERVAL_MS = 50
const LOCK_MAX_RETRIES = 20

function ensureStateDir(): void {
  const dir = dirname(STATE_FILE)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

ensureStateDir()

function parseSessionRecord(value: unknown): SessionRecord | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const record = value as Record<string, unknown>
  if (
    typeof record.pid !== 'number' ||
    typeof record.sessionId !== 'string' ||
    typeof record.cwd !== 'string' ||
    typeof record.projectName !== 'string' ||
    typeof record.startedAt !== 'number' ||
    !isSessionState(record.state)
  ) {
    return undefined
  }
  return {
    pid: record.pid,
    sessionId: record.sessionId,
    cwd: record.cwd,
    projectName: record.projectName,
    startedAt: record.startedAt,
    state: record.state,
    startedRunningAt:
      typeof record.startedRunningAt === 'number'
        ? record.startedRunningAt
        : undefined,
  }
}

function isActivityState(
  value: string,
): value is `tool_call:${string}` | `event:${string}` {
  return value.startsWith('tool_call:') || value.startsWith('event:')
}

function isSessionState(value: unknown): value is SessionState {
  return (
    value === 'running' ||
    value === 'idle' ||
    (typeof value === 'string' && isActivityState(value))
  )
}

function parseState(data: string): DashboardState | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined
  const raw = parsed as Record<string, unknown>
  if (typeof raw.sessions !== 'object' || raw.sessions === null)
    return undefined

  const sessions: Record<string, SessionRecord | undefined> = {}
  for (const [key, value] of Object.entries(raw.sessions)) {
    sessions[key] = parseSessionRecord(value)
  }
  // Records from earlier versions without optional fields parse as-is.
  return { version: 2, sessions }
}

export function readState(): DashboardState {
  if (!existsSync(STATE_FILE)) {
    return { version: 2, sessions: {} }
  }

  try {
    const state = parseState(readFileSync(STATE_FILE, 'utf8'))
    return state ?? { version: 2, sessions: {} }
  } catch {
    return { version: 2, sessions: {} }
  }
}

export async function updateState(
  mutator: (state: DashboardState) => DashboardState,
): Promise<void> {
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
    writeFileSync(STATE_TMP_FILE, JSON.stringify(newState, null, 2), 'utf8')
    renameSync(STATE_TMP_FILE, STATE_FILE)
  } finally {
    await release()
  }
}
