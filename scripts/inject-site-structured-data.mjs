#!/usr/bin/env node
/**
 * Inject Organization + WebSite JSON-LD into dist/index.html after Vite build
 * so the homepage and SPA shell include structured data in <head>.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { injectSiteStructuredDataIntoHtml } from '../src/lib/siteStructuredData.js'

function parseArgs(argv) {
  const args = { dist: 'dist' }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dist') args.dist = argv[++i]
  }
  return args
}

const { dist } = parseArgs(process.argv.slice(2))
const indexPath = join(dist, 'index.html')
const before = readFileSync(indexPath, 'utf8')
const after = injectSiteStructuredDataIntoHtml(before)

if (after === before) {
  console.log(`Site structured data already present in ${indexPath}`)
} else {
  writeFileSync(indexPath, after)
  console.log(`Injected Organization + WebSite JSON-LD into ${indexPath}`)
}
