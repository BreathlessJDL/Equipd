#!/usr/bin/env node
/**
 * Reports the JS/CSS the homepage must download before React can render.
 *
 * Usage:
 *   node scripts/report-homepage-bundle.mjs
 */

import { existsSync, readFileSync, statSync } from 'fs'
import { gzipSync } from 'zlib'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const INDEX_HTML = join(DIST, 'index.html')

if (!existsSync(INDEX_HTML)) {
  console.error('dist/index.html not found. Run the build first.')
  process.exit(1)
}

const html = readFileSync(INDEX_HTML, 'utf8')

function collect(pattern) {
  const out = []
  for (const match of html.matchAll(pattern)) {
    out.push(match[1])
  }
  return out
}

const entryScripts = collect(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)
const preloads = collect(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)
const stylesheets = collect(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)

function measure(urls) {
  const rows = []
  let raw = 0
  let gzip = 0

  for (const url of urls) {
    const filePath = join(DIST, url.replace(/^\//, ''))
    if (!existsSync(filePath)) continue
    const bytes = readFileSync(filePath)
    const gz = gzipSync(bytes).length
    raw += bytes.length
    gzip += gz
    rows.push({ file: url.split('/').pop(), raw: bytes.length, gzip: gz })
  }

  rows.sort((a, b) => b.raw - a.raw)
  return { rows, raw, gzip }
}

function kb(value) {
  return `${(value / 1024).toFixed(1)} kB`
}

const js = measure([...entryScripts, ...preloads])
const css = measure(stylesheets)

console.log('=== Homepage critical JS (entry + modulepreload) ===')
for (const row of js.rows.slice(0, 15)) {
  console.log(`  ${row.file.padEnd(52)} ${kb(row.raw).padStart(10)}  gzip ${kb(row.gzip)}`)
}
if (js.rows.length > 15) console.log(`  … ${js.rows.length - 15} more`)

console.log('\n=== Homepage critical CSS ===')
for (const row of css.rows) {
  console.log(`  ${row.file.padEnd(52)} ${kb(row.raw).padStart(10)}  gzip ${kb(row.gzip)}`)
}

const allJs = measure(
  // Every emitted JS asset, for a whole-app comparison.
  [],
)
void allJs

console.log('\n=== Totals ===')
console.log(`  JS files:      ${js.rows.length}`)
console.log(`  JS raw:        ${kb(js.raw)}`)
console.log(`  JS gzip:       ${kb(js.gzip)}`)
console.log(`  CSS files:     ${css.rows.length}`)
console.log(`  CSS raw:       ${kb(css.raw)}`)
console.log(`  CSS gzip:      ${kb(css.gzip)}`)
console.log(`  HTML:          ${kb(statSync(INDEX_HTML).size)}`)
console.log(`  Total gzip:    ${kb(js.gzip + css.gzip)}`)
console.log(`  Requests:      ${js.rows.length + css.rows.length + 1} (incl. HTML)`)
