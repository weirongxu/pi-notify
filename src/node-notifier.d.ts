/**
 * Minimal type declaration for `node-notifier` (ships without bundled types).
 * Only the surface this extension uses is modeled.
 */
declare module 'node-notifier' {
  export interface NodeNotifierOptions {
    title?: string
    message: string
    wait?: boolean
  }

  export interface NodeNotifier {
    notify(
      options: NodeNotifierOptions,
      callback?: (error: Error | null) => void,
    ): void
  }

  const notifier: NodeNotifier
  export default notifier
}
