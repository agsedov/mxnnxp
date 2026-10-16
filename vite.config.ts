import { cpSync, createReadStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))
const presetsDir = path.join(root, 'presets')

/**
 * Serves the preset catalog and the preset files from `./presets` at
 * `/presets/…` in dev, and copies the directory into `dist/presets/` on build.
 *
 * The presets live outside `public/` because they are authored artifacts (see
 * `presets/index.json`), not app chrome — this plugin is the only thing that
 * knows about them. The build output stays plain files, which is exactly what
 * the static Apache host serves: no server-side logic anywhere.
 */
function presets(): Plugin {
  return {
    name: 'presets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0]
        if (!url.startsWith('/presets/')) return next()
        const file = path.resolve(presetsDir, decodeURIComponent(url.slice('/presets/'.length)))
        // Stay inside ./presets even if the request carries `..` segments.
        if (!file.startsWith(`${presetsDir}${path.sep}`)) return next()
        if (!existsSync(file) || !statSync(file).isFile()) return next()
        res.setHeader(
          'Content-Type',
          file.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
        )
        createReadStream(file).pipe(res)
      })
    },
    closeBundle() {
      cpSync(presetsDir, path.join(root, 'dist', 'presets'), { recursive: true })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), presets()],
})
