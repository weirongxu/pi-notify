import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

import { notify } from './notifier.js'
import type { TmuxTitleTracker } from './tmux-title.js'
import { sleep } from './utils.js'

const DEFAULT_BODY = 'This is a test desktop notification.'

export class NotifyTest {
  constructor(
    private readonly pi: ExtensionAPI,
    private readonly title: string,
    private readonly titleTracker: TmuxTitleTracker,
  ) {}

  register(): void {
    this.pi.registerCommand('notify-test', {
      description: 'Fire a test desktop notification',
      handler: async (args) => {
        await sleep(3000)
        this.titleTracker.mark()
        notify(this.title, args.trim() || DEFAULT_BODY)
      },
    })
  }
}
