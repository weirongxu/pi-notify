import { tsconfig } from '@raidou/eslint-config-base'
import { defineConfig } from 'eslint/config'
export default defineConfig(
  {
    ignores: ['eslint.config.mjs', 'node_modules', 'dist'],
  },
  tsconfig,
)
