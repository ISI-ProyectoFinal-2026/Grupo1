import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// config aparte: vite.config.ts queda intacto para dev y build
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: false,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
  })
)
