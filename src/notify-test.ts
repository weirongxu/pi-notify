import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

import { notify as sendNotification } from './notifier.js'
import { sleep } from './shared/utils.js'
import type { TmuxTitleTracker } from './tmux-title.js'

const DEFAULT_BODY = 'This is a test notification.'

export class NotifyTest {
  private readonly pi: ExtensionAPI
  private readonly title: string
  private readonly titleTracker: TmuxTitleTracker

  constructor(pi: ExtensionAPI, title: string, titleTracker: TmuxTitleTracker) {
    this.pi = pi
    this.title = title
    this.titleTracker = titleTracker
  }

  register(): void {
    this.pi.registerCommand('notify-test', {
      description: 'Fire a test notification',
      handler: async (args) => {
        await sleep(3000)
        this.titleTracker.mark()
        sendNotification(this.title, args.trim() || DEFAULT_BODY)
      },
    })
  }
}
