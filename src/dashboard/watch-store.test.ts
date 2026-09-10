import { renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { afterAll, describe, expect, it, vi } from 'vitest'

vi.mock('./consts.js', async () => {
  const { mkdtempSync } = await import('node:fs')
  const path = await import('node:path')
  const { tmpdir } = await import('node:os')

  const stateDir = mkdtempSync(path.join(tmpdir(), 'pi-notify-watch-test-'))
  return {
    STATE_FILE: path.join(stateDir, 'state.json'),
    STATE_TMP_FILE: path.join(stateDir, 'state.json.tmp'),
  }
})

afterAll(() => {
  rmSync(dirname(STATE_FILE), { recursive: true, force: true })
})

import { STATE_FILE } from './consts.js'
import { watchStore } from './watch-store.js'

const DEBOUNCE_MS = 25

function waitFor(cb: () => boolean, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = (): void => {
      if (cb()) {
        resolve()
        return
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error('waitFor timed out'))
        return
      }
      setTimeout(check, 10)
    }
    check()
  })
}

function writeState(data: string): void {
  const tmp = `${STATE_FILE}.tmp`
  writeFileSync(tmp, data, 'utf8')
  renameSync(tmp, STATE_FILE)
}

describe('watchStore', () => {
  it('fires once for a tmp+rename write', async () => {
    const onChange = vi.fn()
    const stop = watchStore(onChange, { debounceMs: DEBOUNCE_MS })
    try {
      writeState('{"version":2,"sessions":{}}')
      await waitFor(() => onChange.mock.calls.length > 0)
      await new Promise((r) => setTimeout(r, DEBOUNCE_MS * 3))
      expect(onChange).toHaveBeenCalledTimes(1)
    } finally {
      stop()
    }
  })

  it('collapses a burst of writes into one call', async () => {
    const onChange = vi.fn()
    const stop = watchStore(onChange, { debounceMs: DEBOUNCE_MS })
    try {
      writeState('a')
      writeState('b')
      await new Promise((r) => setTimeout(r, DEBOUNCE_MS / 2))
      writeState('c')
      await waitFor(() => onChange.mock.calls.length > 0)
      await new Promise((r) => setTimeout(r, DEBOUNCE_MS * 3))
      expect(onChange).toHaveBeenCalledTimes(1)
    } finally {
      stop()
    }
  })

  it('ignores tmp and lock file writes', async () => {
    const onChange = vi.fn()
    const stop = watchStore(onChange, { debounceMs: DEBOUNCE_MS })
    try {
      writeFileSync(`${STATE_FILE}.tmp`, 'tmp', 'utf8')
      writeFileSync(`${STATE_FILE}.lock`, 'lock', 'utf8')
      await new Promise((r) => setTimeout(r, DEBOUNCE_MS * 5))
      expect(onChange).not.toHaveBeenCalled()
    } finally {
      stop()
      rmSync(`${STATE_FILE}.tmp`, { force: true })
      rmSync(`${STATE_FILE}.lock`, { force: true })
    }
  })

  it('stops events after dispose', async () => {
    const onChange = vi.fn()
    const stop = watchStore(onChange, { debounceMs: DEBOUNCE_MS })
    stop()
    writeState('after-dispose')
    await new Promise((r) => setTimeout(r, DEBOUNCE_MS * 5))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('is idempotent when disposed twice', () => {
    const stop = watchStore(() => {}, { debounceMs: DEBOUNCE_MS })
    stop()
    expect(() => {
      stop()
    }).not.toThrow()
  })
})
