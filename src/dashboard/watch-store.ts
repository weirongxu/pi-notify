import { type FSWatcher, watch } from 'node:fs'
import { basename, dirname } from 'node:path'

import { STATE_FILE } from './consts.js'

const DEFAULT_DEBOUNCE_MS = 150

export function watchStore(
  onChange: () => void,
  opts?: { debounceMs?: number },
): () => void {
  const debounceMs = opts?.debounceMs ?? DEFAULT_DEBOUNCE_MS
  const stateFileName = basename(STATE_FILE)

  let timer: NodeJS.Timeout | null = null
  let closed = false

  let watcher: FSWatcher
  try {
    watcher = watch(dirname(STATE_FILE), (_event, filename) => {
      if (filename !== null && filename !== stateFileName) return
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        onChange()
      }, debounceMs)
      timer.unref()
    })
  } catch {
    return () => {}
  }

  watcher.on('error', () => {
    if (closed) return
    closed = true
    watcher.close()
  })

  return () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (closed) return
    closed = true
    watcher.close()
  }
}
