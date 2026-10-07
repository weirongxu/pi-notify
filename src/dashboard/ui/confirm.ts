import type { Component } from '@earendil-works/pi-tui'
import { matchesKey } from '@earendil-works/pi-tui'

import { wrapUnits } from './footer.js'
import type { Theme } from './theme.js'

export interface ConfirmProps {
  theme: Theme
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export class Confirm implements Component {
  private readonly theme: Theme
  private readonly message: string
  private readonly onConfirm: () => void
  private readonly onCancel: () => void

  constructor({ theme, message, onConfirm, onCancel }: ConfirmProps) {
    this.theme = theme
    this.message = message
    this.onConfirm = onConfirm
    this.onCancel = onCancel
  }

  render(width: number): string[] {
    const units = [this.message, '[y] confirm', '[n] cancel'].map((part) =>
      this.theme.fg('syntaxKeyword', part),
    )
    return wrapUnits(this.theme, width, units)
  }

  invalidate(): void {}

  handleInput(data: string): void {
    if (matchesKey(data, 'y')) {
      this.onConfirm()
    } else {
      this.onCancel()
    }
  }
}
