import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { copyFileSync, mkdirSync } from 'node:fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const root = dirname(fileURLToPath(import.meta.url))

const aliases = {
  '@homeai/core': resolve(root, 'packages/core/src/index.ts'),
  '@homeai/governor': resolve(root, 'packages/governor/src/index.ts'),
  '@homeai/llm': resolve(root, 'packages/llm/src/index.ts'),
  '@homeai/agent': resolve(root, 'packages/agent/src/index.ts'),
  '@homeai/rag': resolve(root, 'packages/rag/src/index.ts'),
  '@homeai/mods': resolve(root, 'packages/mods/src/index.ts'),
  '@homeai/runtime': resolve(root, 'packages/runtime/src/index.ts'),
  '@homeai/ts-intel': resolve(root, 'packages/ts-intel/src/index.mjs'),
  '@homeai/debug': resolve(root, 'packages/debug/src/index.mjs'),
  '@homeai/subagent': resolve(root, 'packages/subagent/src/index.ts'),
}

const rendererAliases = {
  '@homeai/core': aliases['@homeai/core'],
  '@homeai/runtime/browser': resolve(root, 'packages/runtime/src/browser.mjs'),
  '@homeai/runtime': resolve(root, 'packages/runtime/src/renderer-import-denied.mjs'),
  '@homeai/ts-intel': resolve(root, 'packages/ts-intel/src/renderer-import-denied.mjs'),
  '@homeai/debug': resolve(root, 'packages/debug/src/renderer-import-denied.mjs'),
  '@': resolve(root, 'apps/renderer/src')
}

const watchIgnore = [
  '**/AI Resources/**',
  '**/Repos/**',
  '**/data/**',
  '**/node_modules/**',
  '**/.git/**',
  '**/out/**',
  '**/vendor/**',
  '**/RAG/**',
  '**/mods/**',
  '**/notes/**',
  '**/qa/**',
  '**/designs/**'
]

const buildWatch = {
  exclude: watchIgnore,
  chokidar: { ignored: watchIgnore, ignoreInitial: true }
}

function copyTsIntelWorker() {
  return {
    name: 'copy-ts-intel-worker',
    closeBundle() {
      const dest = resolve(root, 'out/main/ts-intel')
      mkdirSync(dest, { recursive: true })
      copyFileSync(resolve(root, 'packages/ts-intel/src/index.mjs'), join(dest, 'index.mjs'))
      copyFileSync(resolve(root, 'packages/ts-intel/src/workspace-worker.mjs'), join(dest, 'workspace-worker.mjs'))
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyTsIntelWorker()],
    build: {
      lib: {
        entry: resolve(root, 'apps/desktop/src/main/index.ts')
      },
      watch: buildWatch
    },
    resolve: { alias: aliases }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve(root, 'apps/desktop/src/preload/index.ts'),
        formats: ['cjs']
      },
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: 'index.js',
          inlineDynamicImports: true
        }
      },
      watch: buildWatch
    }
  },
  renderer: {
    root: resolve(root, 'apps/renderer'),
    plugins: [react()],
    server: {
      port: 5175,
      strictPort: true,
      watch: {
        ignored: watchIgnore
      }
    },
    build: {
      rollupOptions: {
        input: resolve(root, 'apps/renderer/index.html')
      }
    },
    resolve: {
      alias: rendererAliases
    }
  }
})
