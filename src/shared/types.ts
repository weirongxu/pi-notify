export type Unsubscribe = () => void

export type NotifyAction = (body: string) => void

export interface Registerable {
  register(notify: NotifyAction): void
}
