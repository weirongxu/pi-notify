import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildOscSequences,
  osc9,
  osc777,
  sendOsc,
  tmuxPassthrough,
} from './osc.js'
import { stubStdout } from './testing/stdout.js'

describe('osc777', () => {
  it('builds an OSC 777 notify sequence', () => {
    expect(osc777('pi — demo', 'Task finished')).toBe(
      '\x1b]777;notify;pi — demo;Task finished\x07',
    )
  })

  it('handles empty title and body', () => {
    expect(osc777('', '')).toBe('\x1b]777;notify;;\x07')
  })

  it('replaces newlines and strips BEL/ESC from title and body', () => {
    expect(osc777('a\nb', 'x\x07y\x1bz\r\nw\rv')).toBe(
      '\x1b]777;notify;a b;xyz w v\x07',
    )
  })

  it('removes semicolons from the title only', () => {
    expect(osc777('ti;tle', 'bo;dy')).toBe('\x1b]777;notify;ti,tle;bo;dy\x07')
  })
})

describe('osc9', () => {
  it('builds an OSC 9 sequence with body only', () => {
    expect(osc9('Task finished')).toBe('\x1b]9;Task finished\x07')
  })

  it('sanitizes the body but keeps semicolons', () => {
    expect(osc9('a;\nb\x1b\x07')).toBe('\x1b]9;a; b\x07')
  })
})

describe('tmuxPassthrough', () => {
  it('wraps the sequence and doubles every ESC', () => {
    expect(tmuxPassthrough('\x1b]9;hi\x07')).toBe(
      '\x1bPtmux;\x1b\x1b]9;hi\x07\x1b\\',
    )
  })
})

describe('buildOscSequences', () => {
  it('emits both variants unwrapped outside tmux', () => {
    expect(buildOscSequences('t', 'b', false)).toEqual([
      '\x1b]777;notify;t;b\x07',
      '\x1b]9;b\x07',
    ])
  })

  it('wraps both variants inside tmux', () => {
    expect(buildOscSequences('t', 'b', true)).toEqual([
      '\x1bPtmux;\x1b\x1b]777;notify;t;b\x07\x1b\\',
      '\x1bPtmux;\x1b\x1b]9;b\x07\x1b\\',
    ])
  })
})

describe('sendOsc', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('skips writing when stdout is not a TTY', () => {
    const restore = stubStdout(undefined)
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    try {
      sendOsc({ title: 't', body: 'b' })
      expect(write).not.toHaveBeenCalled()
    } finally {
      restore()
      write.mockRestore()
    }
  })

  it('writes both unwrapped sequences when stdout is a TTY outside tmux', () => {
    vi.stubEnv('TMUX', undefined)
    const restore = stubStdout(true)
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    try {
      sendOsc({ title: 't', body: 'b' })
      expect(write).toHaveBeenCalledWith('\x1b]777;notify;t;b\x07\x1b]9;b\x07')
    } finally {
      restore()
      write.mockRestore()
    }
  })

  it('wraps sequences in tmux passthrough', () => {
    vi.stubEnv('TMUX', '/tmp/tmux-0/default,42,0')
    const restore = stubStdout(true)
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    try {
      sendOsc({ title: 't', body: 'b' })
      expect(write).toHaveBeenCalledWith(
        '\x1bPtmux;\x1b\x1b]777;notify;t;b\x07\x1b\\\x1bPtmux;\x1b\x1b]9;b\x07\x1b\\',
      )
    } finally {
      restore()
      write.mockRestore()
    }
  })
})
