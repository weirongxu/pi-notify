import { Registrar } from './shared/registrar.js'

export const JOB_START_EVENT = 'pi-notify:job:start'
export const JOB_END_EVENT = 'pi-notify:job:end'

export class JobTracker extends Registrar {
  private activeJobs = new Set<string>()
  private onStartListeners: Array<() => void> = []
  private onEndListeners: Array<() => void> = []

  get hasActiveJobs(): boolean {
    return this.activeJobs.size > 0
  }

  onStart(listener: () => void): () => void {
    this.onStartListeners.push(listener)
    return () => {
      const index = this.onStartListeners.indexOf(listener)
      if (index !== -1) this.onStartListeners.splice(index, 1)
    }
  }

  onEnd(listener: () => void): () => void {
    this.onEndListeners.push(listener)
    return () => {
      const index = this.onEndListeners.indexOf(listener)
      if (index !== -1) this.onEndListeners.splice(index, 1)
    }
  }

  private extractJobId(params: unknown): string | undefined {
    if (
      typeof params === 'object' &&
      params !== null &&
      'id' in params &&
      typeof params.id === 'string'
    ) {
      return params.id
    }
    return undefined
  }

  protected override setup(): void {
    const startUnsub = this.pi.events.on(JOB_START_EVENT, (params) => {
      const id = this.extractJobId(params)
      if (id !== undefined) {
        this.activeJobs.add(id)
        for (const listener of this.onStartListeners) listener()
      }
    })
    this.unsubscribes.push(startUnsub)

    const endUnsub = this.pi.events.on(JOB_END_EVENT, (params) => {
      const id = this.extractJobId(params)
      if (id !== undefined) {
        for (const listener of this.onEndListeners) listener()
        this.activeJobs.delete(id)
      }
    })
    this.unsubscribes.push(endUnsub)
  }

  override stop(): void {
    super.stop()
    this.activeJobs.clear()
    this.onStartListeners = []
    this.onEndListeners = []
  }
}
