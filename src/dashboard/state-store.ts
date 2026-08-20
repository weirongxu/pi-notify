import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

import { getAgentDir } from '@earendil-works/pi-coding-agent'

export interface SessionRecord {
  pid: number
  cwd: string
  projectName: string
  startedAt: number
  lastHeartbeatAt: number
  state: 'running' | 'idle'
  stateChangedAt: number
  model: string | undefined
  lastEvent: { type: string; summary: string; at: number } | undefined
}

export interface DashboardState {
  version: 1
  sessions: Record<string, SessionRecord | undefined>
}

const STATE_FILE = join(getAgentDir(), 'pi-notify', 'state.json')
const LOCK_FILE = `${STATE_FILE}.lock`
const LOCK_RETRY_DELAY_MS = 50
const LOCK_MAX_RETRIES = 20
const STALE_THRESHOLD_MS = 30000

function ensureStateDir(): void {
  const dir = dirname(STATE_FILE)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

async function acquireLock(retries = LOCK_MAX_RETRIES): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      mkdirSync(LOCK_FILE, { recursive: false })
      return true
    } catch (e) {
      const code =
        e instanceof Error && 'code' in e
          ? (e as NodeJS.ErrnoException).code
          : undefined
      if (code === 'EEXIST') {
        await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_DELAY_MS))
        continue
      }
      if (code === 'ENOENT') {
        ensureStateDir()
        await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_DELAY_MS))
        continue
      }
      throw e
    }
  }
  return false
}

function releaseLock(): void {
  try {
    rmdirSync(LOCK_FILE)
  } catch {
    // Lock file may not exist
  }
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function readState(options?: { filterStale?: boolean }): DashboardState {
  ensureStateDir()
  if (!existsSync(STATE_FILE)) {
    return { version: 1, sessions: {} }
  }

  let state: DashboardState
  try {
    const data = readFileSync(STATE_FILE, 'utf8')
    state = JSON.parse(data) as DashboardState
  } catch {
    return { version: 1, sessions: {} }
  }

  if (options?.filterStale === false) {
    return state
  }

  return cleanupStale(state).cleaned
}

export function readSessions(): SessionRecord[] {
  const state = readState()
  return Object.values(state.sessions).filter(
    (s): s is SessionRecord => s !== undefined,
  )
}

export async function updateState(
  mutator: (state: DashboardState) => DashboardState,
): Promise<void> {
  ensureStateDir()

  const locked = await acquireLock()
  if (!locked) {
    throw new Error('Failed to acquire lock for state update')
  }

  try {
    const state = readState()
    const newState = mutator(state)
    const tmpFile = `${STATE_FILE}.tmp`
    writeFileSync(tmpFile, JSON.stringify(newState, null, 2), 'utf8')
    renameSync(tmpFile, STATE_FILE)
  } finally {
    releaseLock()
  }
}

function cleanupStale(
  state: DashboardState,
  staleThresholdMs = STALE_THRESHOLD_MS,
): { cleaned: DashboardState; removedIds: string[] } {
  const now = Date.now()
  const removedIds: string[] = []
  const sessions: Record<string, SessionRecord | undefined> = {}

  for (const [id, record] of Object.entries(state.sessions)) {
    if (!record) continue
    const heartbeatAge = now - record.lastHeartbeatAt
    const isStale = heartbeatAge > staleThresholdMs
    const isPidAliveValue = isPidAlive(record.pid)

    if (!isStale && isPidAliveValue) {
      sessions[id] = record
    } else {
      removedIds.push(id)
    }
  }

  return { cleaned: { version: 1, sessions }, removedIds }
}
