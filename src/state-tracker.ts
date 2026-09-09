import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import Emittery from 'emittery'

import type { ResolvedNotifyConfig } from './config.js'
import type { JobTracker } from './jobs.js'
import { Registrar } from './shared/registrar.js'
import type { NotifyAction } from './shared/types.js'

export const PI_NOTIFY_EVENT = 'pi-notify:notify'

const IDLE_TIMEOUT_MS = 10000

export class StateTracker extends Registrar {
  readonly events = new Emittery<{
    running: never
    idle: never
    tool: string
    event: string
  }>()

  private readonly jobTracker: JobTracker
  private readonly config: ResolvedNotifyConfig
  private idleTimer: NodeJS.Timeout | null = null
  private running = false
  private hasActivity = false
  private notify: NotifyAction = () => {}

  constructor(
    pi: ExtensionAPI,
    jobTracker: JobTracker,
    config: ResolvedNotifyConfig,
  ) {
    super(pi)
    this.jobTracker = jobTracker
    this.config = config
  }

  private startIdleTimer(): void {
    if (this.jobTracker.hasActiveJobs) return
    this.clearIdleTimer()
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null
      this.running = false
      void this.events.emit('idle')
      if (this.hasActivity && this.config.finished) {
        this.notify('Idle')
      }
    }, IDLE_TIMEOUT_MS)
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
  }

  private markRunning(): void {
    if (this.running) return
    this.running = true
    void this.events.emit('running')
  }

  private setupPiEvents() {
    for (const [channel, message] of Object.entries(this.config.events)) {
      if (typeof message !== 'string' || message === '') continue
      const unsubscribe = this.pi.events.on(channel, () => {
        this.notify(message)
        void this.events.emit('event', channel)
      })
      this.unsubscribes.push(unsubscribe)
    }

    const customEventUnsub = this.pi.events.on(PI_NOTIFY_EVENT, (payload) => {
      this.notify(String(payload))
      void this.events.emit('event', PI_NOTIFY_EVENT)
    })
    this.unsubscribes.push(customEventUnsub)
  }

  private setupToolCall() {
    this.pi.on('tool_call', (event) => {
      if (this.config.notifyTools.has(event.toolName)) {
        this.notify(`Tool call: ${event.toolName}`)
        void this.events.emit('tool', event.toolName)
      }
      this.clearIdleTimer()
    })
  }

  protected override setup(notify: NotifyAction): void {
    this.notify = notify

    this.setupPiEvents()
    this.setupToolCall()

    this.pi.on('turn_start', () => {
      this.hasActivity = true
      this.markRunning()
      this.clearIdleTimer()
    })

    this.pi.on('message_start', () => {
      this.clearIdleTimer()
    })

    this.pi.on('agent_settled', () => {
      this.startIdleTimer()
    })

    this.unsubscribes.push(
      this.jobTracker.onEnd(() => {
        this.startIdleTimer()
      }),
    )
  }

  override stop(): void {
    super.stop()
    this.clearIdleTimer()
    this.hasActivity = false
  }
}
