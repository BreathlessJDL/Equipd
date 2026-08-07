#!/usr/bin/env node
/**
 * Measures homepage LCP / CLS / transferred bytes against a built dist folder.
 *
 * Usage:
 *   node scripts/measure-homepage-vitals.mjs <distDir> <label> [--profile=mobile|desktop]
 */

import { createServer } from 'http'
import { existsSync, readFileSync, statSync } from 'fs'
import { extname, join, normalize } from 'path'
import { brotliCompressSync } from 'zlib'
import { chromium } from 'playwright-core'

const target = process.argv[2]
const label = process.argv[3] ?? target
const profileArg = process.argv.find((arg) => arg.startsWith('--profile='))
const profile = profileArg ? profileArg.split('=')[1] : 'mobile'
const isRemote = /^https?:\/\//.test(target ?? '')
const distDir = isRemote ? null : target

if (!target || (!isRemote && !existsSync(distDir))) {
  console.error(`target not found: ${target}`)
  process.exit(1)
}

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

let server = null
let baseUrl = target

if (!isRemote) {
  server = createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0])
    let filePath = join(distDir, normalize(urlPath))

    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
      const indexCandidate = join(filePath, 'index.html')
      filePath = existsSync(indexCandidate) ? indexCandidate : join(distDir, 'index.html')
    }

    const contentType = MIME[extname(filePath)] ?? 'application/octet-stream'
    let body = readFileSync(filePath)
    const headers = { 'Content-Type': contentType, 'Cache-Control': 'no-store' }

    // Match the CDN: text assets ship compressed, so transfer numbers compare.
    const compressible = /^(text\/|application\/(json|javascript)|image\/svg)/.test(contentType)
    if (compressible && (req.headers['accept-encoding'] ?? '').includes('br')) {
      body = brotliCompressSync(body)
      headers['Content-Encoding'] = 'br'
    }

    headers['Content-Length'] = String(body.length)
    res.writeHead(200, headers)
    res.end(body)
  })

  await new Promise((resolve) => server.listen(0, resolve))
  baseUrl = `http://localhost:${server.address().port}`
}

const PROFILES = {
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    cpuThrottle: 4,
    network: { downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8, latency: 150 },
  },
  desktop: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: false,
    cpuThrottle: 1,
    network: { downloadThroughput: (10 * 1024 * 1024) / 8, uploadThroughput: (5 * 1024 * 1024) / 8, latency: 40 },
  },
}

const config = PROFILES[profile]
const browser = await chromium.launch({ headless: true, channel: 'msedge' })

const RUNS = 3
const samples = []

for (let run = 0; run < RUNS; run += 1) {
  const context = await browser.newContext({
    viewport: config.viewport,
    deviceScaleFactor: config.deviceScaleFactor,
    isMobile: config.isMobile,
    hasTouch: config.isMobile,
  })
  const page = await context.newPage()

  let transferred = 0
  let requestCount = 0
  page.on('response', async (response) => {
    requestCount += 1
    try {
      const lengthHeader = response.headers()['content-length']
      transferred += lengthHeader ? Number(lengthHeader) : (await response.body()).length
    } catch {
      // Redirects / aborted responses have no body.
    }
  })

  const client = await context.newCDPSession(page)
  await client.send('Network.enable')
  await client.send('Network.emulateNetworkConditions', { offline: false, ...config.network })
  await client.send('Emulation.setCPUThrottlingRate', { rate: config.cpuThrottle })

  await page.addInitScript(() => {
    window.__vitals = { lcp: 0, cls: 0, lcpElement: '' }
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__vitals.lcp = entry.startTime
        window.__vitals.lcpElement = entry.element
          ? `${entry.element.tagName.toLowerCase()}.${entry.element.className || ''}`.slice(0, 60)
          : entry.url || ''
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true })

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__vitals.cls += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })

  await page.goto(`${baseUrl}/`, { waitUntil: 'load', timeout: 90000 })
  await page.waitForTimeout(4000)

  const result = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]
    return {
      ttfb: nav ? nav.responseStart : 0,
      fcp: fcp ? fcp.startTime : 0,
      domContentLoaded: nav ? nav.domContentLoadedEventEnd : 0,
      lcp: window.__vitals.lcp,
      cls: window.__vitals.cls,
      lcpElement: window.__vitals.lcpElement,
    }
  })

  samples.push({ ...result, transferred, requestCount })
  await context.close()
}

await browser.close()
server?.close()

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

const summary = {
  label,
  profile,
  ttfbMs: Math.round(median(samples.map((s) => s.ttfb))),
  fcpMs: Math.round(median(samples.map((s) => s.fcp))),
  lcpMs: Math.round(median(samples.map((s) => s.lcp))),
  cls: Number(median(samples.map((s) => s.cls)).toFixed(4)),
  transferredKb: Math.round(median(samples.map((s) => s.transferred)) / 1024),
  requests: Math.round(median(samples.map((s) => s.requestCount))),
  lcpElement: samples[samples.length - 1].lcpElement,
}

console.log(JSON.stringify(summary))
