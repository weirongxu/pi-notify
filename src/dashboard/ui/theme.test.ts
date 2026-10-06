import { describe, expect, it } from 'vitest'

import { createTheme } from './theme.js'

describe('createTheme', () => {
  it('emits ANSI codes for fg and underline when colors are enabled', () => {
    const previousNoColor = process.env.NO_COLOR
    delete process.env.NO_COLOR
    try {
      const theme = createTheme()
      // eslint-disable-next-line no-control-regex
      const ANSI_RE = /\x1b\[.*m/
      expect(theme.fg('success', 'x')).toMatch(ANSI_RE)
      expect(theme.underline('x')).toMatch(ANSI_RE)
    } finally {
      if (previousNoColor !== undefined) process.env.NO_COLOR = previousNoColor
    }
  })

  it('returns plain text when NO_COLOR is set', () => {
    const previousNoColor = process.env.NO_COLOR
    process.env.NO_COLOR = '1'
    try {
      const theme = createTheme()
      expect(theme.fg('success', 'x')).toBe('x')
      expect(theme.underline('x')).toBe('x')
    } finally {
      if (previousNoColor === undefined) delete process.env.NO_COLOR
      else process.env.NO_COLOR = previousNoColor
    }
  })
})
