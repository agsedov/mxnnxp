#!/usr/bin/env node
/**
 * Bundle the app for the production server.
 *
 * Target: Ubuntu + Apache, files living in `/var/www/html/mxnnxp/` — i.e. the
 * site is served under the `/mxnnxp/` URL prefix. The build therefore sets
 * Vite's `base` to that prefix, so the page asks the server for
 * `/mxnnxp/assets/…` rather than `/assets/…` (which the default Apache
 * `DocumentRoot` would not find). The dev server keeps its own default base, so
 * `npm run dev` and the smoke script are unaffected.
 *
 * The archive carries a top-level `mxnnxp/` directory, the layout from
 * `/var/www/html/` down, so unzipping it into `/var/www/html/` lands the files
 * exactly in `/var/www/html/mxnnxp/`.
 *
 * Usage: npm run bundle        (BASE_PATH=/ to serve from a host root instead)
 */

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Directory name on the server (and the top-level directory in the archive). */
const APP = 'mxnnxp'
/** URL prefix the bundle is served under. */
const BASE = process.env.BASE_PATH ?? `/${APP}/`
const DIST = path.join(root, 'dist')
const RELEASE = path.join(root, 'release')

/** Run a command in the repo, inheriting stdio; abort the script if it fails. */
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) {
    console.error(`\n! ${command} ${args.join(' ')} exited with code ${result.status}`)
    process.exit(result.status ?? 1)
  }
}

/** Run a command and return its trimmed stdout, or null if it is unavailable. */
function capture(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' })
  return result.error || result.status !== 0 ? null : result.stdout.trim()
}

if (!capture('zip', ['-v'])) {
  console.error('! `zip` is not installed — run: sudo apt-get install -y zip')
  process.exit(1)
}

console.log(`\n▸ Building with base ${BASE}`)
// The extra arguments are appended to the whole `build` script, so they reach
// the trailing `vite build`; the guard below catches it if that ever changes.
run('npm', ['run', 'build', '--', `--base=${BASE}`])

const indexHtml = path.join(DIST, 'index.html')
if (!existsSync(indexHtml)) {
  console.error('! dist/index.html is missing — did the build fail?')
  process.exit(1)
}
// Without the base in place the deployed page would request /assets/… outside
// /mxnnxp/ and come up blank; fail here rather than on the server.
if (!readFileSync(indexHtml, 'utf8').includes(`${BASE}assets/`)) {
  console.error(`! dist/index.html does not reference ${BASE}assets/ — base was not applied`)
  process.exit(1)
}

const date = new Date().toISOString().slice(0, 10)
const sha = capture('git', ['rev-parse', '--short', 'HEAD'])
const name = `${APP}-${date}${sha ? `-${sha}` : ''}.zip`
const zipPath = path.join(RELEASE, name)

mkdirSync(RELEASE, { recursive: true })
// Stage the dist under a directory named after the app, then zip from the
// staging root: that is what puts `mxnnxp/…` at the top of the archive.
const stage = mkdtempSync(path.join(tmpdir(), 'mxnnxp-bundle-'))
try {
  cpSync(DIST, path.join(stage, APP), { recursive: true })
  rmSync(zipPath, { force: true })
  run('zip', ['-r', '-q', '-X', zipPath, APP], { cwd: stage })
} finally {
  rmSync(stage, { recursive: true, force: true })
}

const relative = path.relative(root, zipPath)
const size = (statSync(zipPath).size / 1024).toFixed(1)
const digest = capture('sha256sum', [zipPath])?.split(/\s+/)[0]
const remote = `/tmp/${name}`

console.log(`
✓ ${relative}  (${size} KB${digest ? `, sha256 ${digest}` : ''})

Deploy to the Apache host (site root /var/www/html/${APP}/):

  scp ${relative} user@server:${remote}
  ssh user@server "sudo unzip -o ${remote} -d /var/www/html/ && sudo chown -R www-data:www-data /var/www/html/${APP}"

Unzip into /var/www/html/, not into /var/www/html/${APP}/: the archive already
contains the ${APP}/ directory. Apache needs no extra modules or rewrites — the
canvas state rides in the URL's hash fragment, so every request is for a file.
`)
