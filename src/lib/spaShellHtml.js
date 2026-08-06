/**
 * Load the Vite-built SPA shell (index.html with module scripts + CSS).
 * Used by runtime listing HTML so React can replace SEO body content.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { injectSeoIntoHtml } from './seoCataloguePrerender.js'
import { buildStandaloneSeoHtml } from './standaloneSeoHtml.js'

export function resolveSpaShellCandidates(cwd = process.cwd()) {
  return [
    join(cwd, 'index.html'),
    join(cwd, 'dist', 'index.html'),
    join(cwd, '..', 'index.html'),
    join(cwd, '.vercel', 'output', 'static', 'index.html'),
  ]
}

export function readSpaShellHtmlFromDisk(cwd = process.cwd()) {
  for (const filePath of resolveSpaShellCandidates(cwd)) {
    if (!existsSync(filePath)) continue
    try {
      const html = readFileSync(filePath, 'utf8')
      if (isValidSpaShellHtml(html)) {
        return html
      }
    } catch {
      // try next candidate
    }
  }
  return null
}

export function isValidSpaShellHtml(html) {
  if (!html || typeof html !== 'string') return false
  if (!html.includes('id="root"')) return false
  if (!/type\s*=\s*["']module["']/i.test(html)) return false
  // Never serve the Vite source entry — production must boot hashed /assets/*.js.
  if (/src\s*=\s*["']\/src\/main\.(jsx|tsx|js|ts)["']/i.test(html)) return false
  return true
}

export function resolveSpaShellOrigin({ headers } = {}) {
  const envOrigin =
    process.env.EQUIPD_SITE_ORIGIN?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    process.env.VITE_SITE_ORIGIN?.trim()

  if (envOrigin) {
    return envOrigin.replace(/\/$/, '')
  }

  const host = headers?.['x-forwarded-host'] || headers?.host
  if (!host) {
    return 'https://www.equipd.co.uk'
  }

  const proto = headers?.['x-forwarded-proto'] || 'https'
  return `${proto}://${String(host).split(',')[0].trim()}`
}

/**
 * @param {{ headers?: Record<string, string | string[] | undefined>, fetchImpl?: typeof fetch }} [options]
 */
export async function loadSpaShellHtml(options = {}) {
  const fromDisk = readSpaShellHtmlFromDisk()
  if (fromDisk) {
    return { html: fromDisk, source: 'disk' }
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    throw new Error('SPA shell HTML unavailable (no disk template and fetch is not available)')
  }

  const origin = resolveSpaShellOrigin(options)
  const url = `${origin}/index.html`
  const response = await fetchImpl(url, {
    headers: { Accept: 'text/html' },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`Failed to load SPA shell from ${url} (${response.status})`)
  }

  const html = await response.text()
  if (!isValidSpaShellHtml(html)) {
    throw new Error('SPA shell HTML is missing #root or module bootstrap script')
  }

  return { html, source: 'fetch' }
}

/**
 * Prefer SPA shell + SEO inject so users always get React. Fall back to
 * scriptless standalone HTML only if the shell cannot be loaded (keeps crawlers alive).
 *
 * @param {object} document
 * @param {{ headers?: Record<string, string | string[] | undefined>, fetchImpl?: typeof fetch, allowStandaloneFallback?: boolean }} [options]
 */
export async function renderSeoDocumentHtml(document, options = {}) {
  const allowStandaloneFallback = options.allowStandaloneFallback !== false

  try {
    const shell = await loadSpaShellHtml(options)
    return {
      html: injectSeoIntoHtml(shell.html, document),
      mode: 'spa_shell',
      shellSource: shell.source,
    }
  } catch (error) {
    if (!allowStandaloneFallback) {
      throw error
    }

    return {
      html: buildStandaloneSeoHtml(document),
      mode: 'standalone_fallback',
      shellSource: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
