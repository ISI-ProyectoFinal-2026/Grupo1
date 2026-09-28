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
      coverage: {
        provider: 'v8',
        // Criterio de aceptacion de #42: el piso lo hace cumplir la herramienta,
        // no la memoria de quien revisa el PR.
        thresholds: { statements: 70, branches: 70, functions: 70, lines: 70 },
        reporter: ['text-summary', 'html', 'lcov'],
        // `include` explicito para que los archivos que ningun test importa
        // igual cuenten en el porcentaje. Sin esto el reporte solo mide lo que
        // ya esta cubierto y el numero global queda inflado.
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.{test,spec}.{ts,tsx}',
          'src/test/**',
          // Bootstrap de React: monta el arbol y nada mas.
          'src/main.tsx',
          'src/vite-env.d.ts',
          // Archivos de tipos puros: no emiten runtime, no hay nada que cubrir.
          // src/types/validators/ si tiene codigo (zod) y queda incluido.
          'src/types/*.ts',
        ],
      },
    },
  })
)
