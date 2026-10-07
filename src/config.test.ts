import { describe, expect, it } from 'vitest'

import { parseConfig } from './config.js'

describe('parseConfig', () => {
  it('returns malformed for invalid JSON', () => {
    expect(parseConfig('{not json')).toEqual({ status: 'malformed' })
  })

  it('returns empty settings and piNotify for non-record JSON', () => {
    for (const content of ['[1,2]', '42', 'null', '"str"']) {
      expect(parseConfig(content)).toEqual({
        status: 'valid',
        settings: {},
        piNotify: {},
      })
    }
  })

  it('returns empty piNotify when record has no piNotify', () => {
    expect(parseConfig('{"foo": 1}')).toEqual({
      status: 'valid',
      settings: { foo: 1 },
      piNotify: {},
    })
  })

  it('parses piNotify fields', () => {
    const content = JSON.stringify({
      piNotify: {
        enabled: false,
        notifyTools: ['a', 'b'],
        events: { session: 'all', finished: false },
        finished: false,
        onlyNotifyWhenUnfocused: false,
        unfocusedActivityThresholdSecs: 5,
        tmuxSymbol: '!',
        dashboardTmuxKey: 'ctrl+g',
        dashboardTmuxKeyNeedsPrefix: true,
      },
    })
    expect(parseConfig(content)).toEqual({
      status: 'valid',
      settings: JSON.parse(content),
      piNotify: {
        enabled: false,
        notifyTools: ['a', 'b'],
        events: { session: 'all', finished: false },
        finished: false,
        onlyNotifyWhenUnfocused: false,
        unfocusedActivityThresholdSecs: 5,
        tmuxSymbol: '!',
        dashboardTmuxKey: 'ctrl+g',
        dashboardTmuxKeyNeedsPrefix: true,
      },
    })
  })

  it('falls back to empty piNotify when piNotify is not an object', () => {
    expect(parseConfig('{"piNotify": "x"}')).toEqual({
      status: 'valid',
      settings: { piNotify: 'x' },
      piNotify: {},
    })
  })

  it('falls back to empty piNotify on invalid field types', () => {
    const content = JSON.stringify({
      piNotify: {
        enabled: 'yes',
        events: 'all',
        unfocusedActivityThresholdSecs: 'x',
      },
    })
    expect(parseConfig(content)).toEqual({
      status: 'valid',
      settings: JSON.parse(content),
      piNotify: {},
    })
  })
})
