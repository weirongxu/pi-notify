import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Tests share the real global state.json, so test files must run serially.
    fileParallelism: false,
  },
})
