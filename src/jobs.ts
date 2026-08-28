import { Registrar } from './shared/registrar.js'

export const JOB_START_EVENT = 'pi-notify:job:start'
export const JOB_END_EVENT = 'pi-notify:job:end'

export class JobTracker extends Registrar {
  private activeJobs = new Set<string>()
  private onEndListeners: Array<() => void> = []

  get hasActiveJobs(): boolean {
    return this.activeJobs.size > 0
  }

  onEnd(listener: () => void): () => void {
    this.onEndListeners.push(listener)
    return () => {
      const index = this.onEndListeners.indexOf(listener)
      if (index !== -1) this.onEndListeners.splice(index, 1)
    }
  }

  protected override setup(): void {
    const startUnsub = this.pi.events.on(JOB_START_EVENT, (params) => {
      if (
        typeof params === 'object' &&
        params !== null &&
        'id' in params &&
        typeof params.id === 'string'
      ) {
        this.activeJobs.add(params.id)
      }
    })
    this.unsubscribes.push(startUnsub)

    const endUnsub = this.pi.events.on(JOB_END_EVENT, (params) => {
      if (
        typeof params === 'object' &&
        params !== null &&
        'id' in params &&
        typeof params.id === 'string'
      ) {
        for (const listener of this.onEndListeners) listener()
        this.activeJobs.delete(params.id)
      }
    })
    this.unsubscribes.push(endUnsub)
  }

  override stop(): void {
    super.stop()
    this.activeJobs.clear()
  }
}
