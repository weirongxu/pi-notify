import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui'

import type { Theme } from './theme.js'

export function wrapUnits(
  theme: Theme,
  width: number,
  units: string[],
): string[] {
  const sep = theme.fg('dim', ' · ')
  const lines: string[] = []
  let line = ''
  for (const unit of units) {
    const candidate = line === '' ? unit : `${line}${sep}${unit}`
    if (visibleWidth(candidate) <= width) {
      line = candidate
    } else {
      if (line !== '') lines.push(line)
      line = truncateToWidth(unit, width, '…')
    }
  }
  if (line !== '') lines.push(line)
  return lines
}
