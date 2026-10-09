import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { notify } from './notifier.js'
import { stubStdout } from './testing/stdout.js'

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
  notify: vi.fn(),
}))

vi.mock('node:child_process', () => ({ execFile: mocks.execFile }))

vi.mock('node-notifier', () => ({ default: { notify: mocks.notify } }))

const OSC_SEQUENCES = '\x1b]777;notify;t;b\x07\x1b]9;b\x07'

function nativeCallCount(): number {
  return mocks.execFile.mock.calls.length + mocks.notify.mock.calls.length
}

describe('notify channel switches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.execFile.mockImplementation(() => {})
    mocks.notify.mockImplementation((_options, callback) => callback())
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('has no side effects when both channels are disabled', () => {
    vi.stubEnv('TMUX', undefined)
    const restore = stubStdout(true)
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    try {
      notify('t', 'b', { osc: false, desktop: false })
      expect(write).not.toHaveBeenCalled()
      expect(nativeCallCount()).toBe(0)
    } finally {
      restore()
      write.mockRestore()
    }
  })

  it('sends only OSC when desktop is disabled', () => {
    vi.stubEnv('TMUX', undefined)
    const restore = stubStdout(true)
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    try {
      notify('t', 'b', { osc: true, desktop: false })
      expect(write).toHaveBeenCalledWith(OSC_SEQUENCES)
      expect(nativeCallCount()).toBe(0)
    } finally {
      restore()
      write.mockRestore()
    }
  })

  it('sends only the native notification when osc is disabled', async () => {
    const restore = stubStdout(true)
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    try {
      notify('t', 'b', { osc: false, desktop: true })
      expect(write).not.toHaveBeenCalled()
      await vi.waitFor(() => {
        expect(nativeCallCount()).toBe(1)
      })
      if (mocks.notify.mock.calls.length === 0) {
        expect(mocks.execFile.mock.calls[0]?.[0]).toMatch(
          /^powershell(\.exe)?$/,
        )
      }
    } finally {
      restore()
      write.mockRestore()
    }
  })

  it('sends both channels when both are enabled', async () => {
    vi.stubEnv('TMUX', undefined)
    const restore = stubStdout(true)
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    try {
      notify('t', 'b', { osc: true, desktop: true })
      expect(write).toHaveBeenCalledWith(OSC_SEQUENCES)
      await vi.waitFor(() => {
        expect(nativeCallCount()).toBe(1)
      })
    } finally {
      restore()
      write.mockRestore()
    }
  })
})
