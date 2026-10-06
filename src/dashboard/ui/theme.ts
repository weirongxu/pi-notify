// Local semantic theme. pi-tui's styleText does not honor NO_COLOR, so it is
// handled here.
import type { TextStyle } from '@earendil-works/pi-tui'
import {
  getTerminalColorMode,
  parseColor,
  styleText,
} from '@earendil-works/pi-tui'

export type ThemeColor =
  'borderAccent' | 'dim' | 'syntaxKeyword' | 'success' | 'muted' | 'text'

export interface Theme {
  fg(color: ThemeColor, text: string): string
  underline(text: string): string
}

const ROLE_STYLES: Record<ThemeColor, TextStyle> = {
  borderAccent: { fg: parseColor('#00afd7') },
  dim: { dim: true },
  syntaxKeyword: { fg: parseColor('#d787ff') },
  success: { fg: parseColor('#5fd75f') },
  muted: { fg: parseColor('#808080') },
  text: {},
}

export function createTheme(): Theme {
  if (process.env.NO_COLOR) {
    return {
      fg: (_color, text) => text,
      underline: (text) => text,
    }
  }
  const mode = getTerminalColorMode()
  return {
    fg: (color, text) => styleText(text, ROLE_STYLES[color], mode),
    underline: (text) => styleText(text, { underline: true }, mode),
  }
}
