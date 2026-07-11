const PAGE_FETCH_TIMEOUT_MS = 10_000
export const MAX_PAGE_BYTES = 500_000
export const MAX_PDF_BYTES = 750_000
export const MAX_PAGES_TO_FETCH = 20
export const PAGE_FETCH_CONCURRENCY = 4
export const PAGE_PARSE_BUDGET_MS = 750
export const MAX_VISIBLE_BODY_CHARS = 4_000
export const MAX_HTML_HEAD_SCAN_CHARS = 32_000
export const MAX_HTML_STRUCTURED_SCAN_CHARS = 150_000
export const MAX_PDF_SCAN_CHARS = 400_000
export const KEYWORD_WINDOW_BEFORE = 400
export const KEYWORD_WINDOW_AFTER = 600
export const MAX_KEYWORD_WINDOWS_PER_NEEDLE = 3

export const RESEARCH_KEYWORD_NEEDLES = [
  'rrp',
  'msrp',
  'list price',
  'retail price',
  'original price',
  'launch',
  'discontinued',
  'production',
  'release year',
  'manufactured',
] as const

export const AI_PAGE_CONTENT_MAX_CHARS = 4_000
export const EVIDENCE_MARKER_WINDOW_BEFORE = 800
export const EVIDENCE_MARKER_WINDOW_AFTER = 1_500

export const PRICE_EVIDENCE_MARKERS = [
  /\blist price\b/i,
  /\brrp\b/i,
  /\bmsrp\b/i,
  /\boriginal price\b/i,
  /\bnew price\b/i,
  /\bretail price\b/i,
  /\bwas\b/i,
  /\bour price\b/i,
  /\bprice\s*£/i,
  /\bfrom\s*£\s*[\d,]+(?:\.\d{2})?/i,
  /\bstarting from\s*£\s*[\d,]+(?:\.\d{2})?/i,
  /\bprice from\s*£\s*[\d,]+(?:\.\d{2})?/i,
  /\bfull price\s*£\s*[\d,]+(?:\.\d{2})?/i,
  /\bcash price\s*£\s*[\d,]+(?:\.\d{2})?/i,
  /£\s*[\d,]+(?:\.\d{2})?/i,
] as const

export const FINANCE_PRICE_CONTEXT_PATTERN = /\b(per month|\/month|monthly|finance|financing|spread the cost)\b/i

export const PAGE_FETCH_BOT_USER_AGENT = 'EquipdIntelligenceBot/1.0 (admin market sync POC)'
export const PAGE_FETCH_BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

export const LIFECYCLE_EVIDENCE_MARKERS = [
  /\bmanufactured\b/i,
  /\bintroduced\b/i,
  /\blaunched\b/i,
  /\bdiscontinued\b/i,
  /\bproduction\b/i,
  /\bmodel year\b/i,
  /\bavailable from\b/i,
  /\breleased\b/i,
] as const

export type PageExtractedContent = {
  title: string
  metaDescription: string
  jsonLdText: string
  bodyText: string
  combinedText: string
}

type EvidenceWindowRange = {
  start: number
  end: number
  category: 'price' | 'lifecycle'
}

export type PageFetchResult = {
  ok: boolean
  error?: string
  content?: PageExtractedContent
  rawHtml?: string
}

export type PageFetchAttemptLog = {
  url: string
  initial_status: number | null
  retry_status: number | null
  user_agent_used: string
  retried_after_403: boolean
}

export function isFinancePriceContext(
  text: string,
  matchIndex: number,
  matchLength: number,
  contextRadius = 80,
): boolean {
  const after = text.slice(matchIndex + matchLength, matchIndex + matchLength + 60)

  // Cash price followed by a monthly alternative, e.g. £11,800 / £159.38 per month
  if (/^\s*\/\s*£/.test(after)) {
    return false
  }

  const monthlyMatch = after.match(/\b(per month|\/month|monthly)\b/i)
  if (monthlyMatch?.index != null) {
    const between = after.slice(0, monthlyMatch.index)
    if (!/£/.test(between)) {
      return true
    }
  }

  const before = text.slice(Math.max(0, matchIndex - contextRadius), matchIndex)
  if (/\b(spread the cost)\b/i.test(before.slice(-40)) || /\b(spread the cost)\b/i.test(after.slice(0, 25))) {
    return true
  }

  return false
}

export function extractEmbeddedStatePriceText(html: string): string {
  const parts: string[] = []

  for (const script of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    const content = script[1] ?? ''
    if (!/"price"\s*:/i.test(content)) continue

    for (const match of content.matchAll(/"price"\s*:\s*(\d{3,}(?:\.\d{2})?)/gi)) {
      const index = match.index
      if (index == null) continue
      if (isFinancePriceContext(content, index, match[0].length, 120)) continue

      const value = Number(match[1].replace(/,/g, ''))
      if (!Number.isFinite(value) || value < 100) continue

      parts.push(`£${value.toLocaleString('en-GB')}`)
      parts.push(`${value} GBP`)
    }
  }

  return normalizeExtractedText([...new Set(parts)].join(' '))
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

function stripHtmlTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' '))
}

function normalizeExtractedText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function extractHtmlTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeExtractedText(stripHtmlTags(match?.[1] ?? ''))
}

function extractMetaDescription(html: string): string {
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["'][^>]*>/i,
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      return normalizeExtractedText(decodeHtmlEntities(match[1]))
    }
  }

  return ''
}

function normalizeJsonLdNodes(data: unknown): Record<string, unknown>[] {
  if (!data) return []

  if (Array.isArray(data)) {
    return data.flatMap((item) => normalizeJsonLdNodes(item))
  }

  if (typeof data !== 'object') return []

  const record = data as Record<string, unknown>
  const graph = record['@graph']

  if (Array.isArray(graph)) {
    return graph.filter((item) => typeof item === 'object' && item !== null) as Record<
      string,
      unknown
    >[]
  }

  return [record]
}

function isProductType(value: unknown): boolean {
  if (typeof value === 'string') return value.toLowerCase() === 'product'
  if (Array.isArray(value)) {
    return value.some((item) => typeof item === 'string' && item.toLowerCase() === 'product')
  }
  return false
}

function extractJsonLdProductText(node: Record<string, unknown>): string {
  if (!isProductType(node['@type'])) return ''

  const parts: string[] = []
  const name = node.name
  const description = node.description

  if (typeof name === 'string') parts.push(name)
  if (typeof description === 'string') parts.push(description)

  const offers = node.offers
  const offerList = Array.isArray(offers) ? offers : offers ? [offers] : []

  for (const offer of offerList) {
    if (!offer || typeof offer !== 'object') continue
    const offerRecord = offer as Record<string, unknown>
    const price = offerRecord.price ?? offerRecord.lowPrice ?? offerRecord.highPrice
    const currency = String(offerRecord.priceCurrency ?? 'GBP').toUpperCase()

    if (price == null) continue

    if (currency === 'GBP') {
      parts.push(`£${price}`)
      parts.push(`${price} GBP`)
    }
  }

  return parts.join(' ')
}

function extractJsonLdText(html: string): string {
  const scripts = [
    ...html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ]
  const parts: string[] = []

  for (const script of scripts) {
    const raw = script[1]?.trim()
    if (!raw) continue

    try {
      const parsed = JSON.parse(raw)
      for (const node of normalizeJsonLdNodes(parsed)) {
        const text = extractJsonLdProductText(node)
        if (text) parts.push(text)
      }
    } catch {
      // ignore invalid JSON-LD blocks
    }
  }

  return normalizeExtractedText(parts.join(' '))
}

function extractVisibleBodyText(html: string): string {
  return extractKeywordWindowBodyText(html)
}

export function extractKeywordWindowBodyText(html: string): string {
  const scanHtml = html.slice(0, MAX_PAGE_BYTES)
  const mainStart = scanHtml.search(/<main\b/i)
  const bodyTag = scanHtml.match(/<body[^>]*>/i)
  const contentStart = mainStart >= 0
    ? mainStart
    : bodyTag?.index ?? 0
  const searchableHtml = scanHtml.slice(contentStart)
  const lowerHtml = searchableHtml.toLowerCase()
  const windows: string[] = []

  for (const needle of RESEARCH_KEYWORD_NEEDLES) {
    let position = 0
    let found = 0

    while (found < MAX_KEYWORD_WINDOWS_PER_NEEDLE) {
      const index = lowerHtml.indexOf(needle, position)
      if (index === -1) break

      const start = Math.max(0, index - KEYWORD_WINDOW_BEFORE)
      const end = Math.min(searchableHtml.length, index + needle.length + KEYWORD_WINDOW_AFTER)
      const chunk = stripHtmlTags(searchableHtml.slice(start, end))
      const normalized = normalizeExtractedText(chunk)
      if (normalized) windows.push(normalized)

      position = index + needle.length
      found += 1
    }
  }

  if (!windows.length) {
    const fallback = stripHtmlTags(searchableHtml.slice(0, 8_000))
    return normalizeExtractedText(fallback).slice(0, MAX_VISIBLE_BODY_CHARS)
  }

  return normalizeExtractedText(windows.join(' ')).slice(0, MAX_VISIBLE_BODY_CHARS)
}

function mergeEvidenceWindowRanges(ranges: EvidenceWindowRange[]): EvidenceWindowRange[] {
  if (ranges.length === 0) return []

  const sorted = [...ranges].sort((left, right) => left.start - right.start)
  const merged: EvidenceWindowRange[] = [sorted[0]]

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index]
    const previous = merged[merged.length - 1]

    if (current.start <= previous.end) {
      previous.end = Math.max(previous.end, current.end)
      if (current.category !== previous.category) {
        previous.category = 'price'
      }
      continue
    }

    merged.push(current)
  }

  return merged
}

function collectEvidenceWindows(
  text: string,
  patterns: readonly RegExp[],
  category: EvidenceWindowRange['category'],
  before = EVIDENCE_MARKER_WINDOW_BEFORE,
  after = EVIDENCE_MARKER_WINDOW_AFTER,
): EvidenceWindowRange[] {
  const ranges: EvidenceWindowRange[] = []

  for (const pattern of patterns) {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
    const matcher = new RegExp(pattern.source, flags)

    for (const match of text.matchAll(matcher)) {
      const index = match.index
      if (index == null) continue
      if (isFinancePriceContext(text, index, match[0].length)) continue

      ranges.push({
        start: Math.max(0, index - before),
        end: Math.min(text.length, index + match[0].length + after),
        category,
      })
    }
  }

  return ranges
}

function trimWindowToMarkerContext(excerpt: string, markers: readonly RegExp[], contextBefore = 120): string {
  let earliest = excerpt.length

  for (const pattern of markers) {
    const match = excerpt.match(pattern)
    if (match?.index != null) {
      earliest = Math.min(earliest, match.index)
    }
  }

  if (earliest === excerpt.length) return excerpt
  return excerpt.slice(Math.max(0, earliest - contextBefore)).trim()
}

export function extractEvidenceWindowTexts(
  text: string,
  options: {
    before?: number
    after?: number
  } = {},
): { price: string[]; lifecycle: string[] } {
  const before = options.before ?? EVIDENCE_MARKER_WINDOW_BEFORE
  const after = options.after ?? EVIDENCE_MARKER_WINDOW_AFTER
  const normalized = normalizeExtractedText(text)

  if (!normalized) {
    return { price: [], lifecycle: [] }
  }

  const priceRanges = collectEvidenceWindows(normalized, PRICE_EVIDENCE_MARKERS, 'price', before, after)
  const lifecycleRanges = collectEvidenceWindows(
    normalized,
    LIFECYCLE_EVIDENCE_MARKERS,
    'lifecycle',
    before,
    after,
  )
  const merged = mergeEvidenceWindowRanges([...priceRanges, ...lifecycleRanges])

  const price: string[] = []
  const lifecycle: string[] = []

  for (const range of merged) {
    const excerpt = normalized.slice(range.start, range.end).trim()
    if (!excerpt) continue

    const hasPriceMarker = PRICE_EVIDENCE_MARKERS.some((pattern) => pattern.test(excerpt))
    const hasLifecycleMarker = LIFECYCLE_EVIDENCE_MARKERS.some((pattern) => pattern.test(excerpt))

    if (hasPriceMarker && !price.includes(excerpt)) {
      price.push(trimWindowToMarkerContext(excerpt, PRICE_EVIDENCE_MARKERS, 60))
    }
    if (hasLifecycleMarker && !lifecycle.includes(excerpt)) {
      lifecycle.push(trimWindowToMarkerContext(excerpt, LIFECYCLE_EVIDENCE_MARKERS))
    }
  }

  return { price, lifecycle }
}

function buildFallbackPageSummary(text: string, coveredRanges: EvidenceWindowRange[], maxChars: number): string {
  if (maxChars <= 0 || !text) return ''

  const uncovered: string[] = []
  let cursor = 0

  for (const range of mergeEvidenceWindowRanges(coveredRanges)) {
    if (range.start > cursor) {
      uncovered.push(text.slice(cursor, range.start))
    }
    cursor = Math.max(cursor, range.end)
  }

  if (cursor < text.length) {
    uncovered.push(text.slice(cursor))
  }

  const tail = normalizeExtractedText(uncovered.join(' '))
  if (!tail) {
    return normalizeExtractedText(text.slice(-maxChars))
  }

  return tail.length <= maxChars ? tail : tail.slice(-maxChars)
}

export function preparePageContentForAi(
  content: Pick<PageExtractedContent, 'title' | 'metaDescription' | 'jsonLdText' | 'bodyText'>,
  maxChars = AI_PAGE_CONTENT_MAX_CHARS,
): string {
  const searchableText = normalizeExtractedText(
    [content.bodyText, content.jsonLdText].filter(Boolean).join(' '),
  )
  const evidence = extractEvidenceWindowTexts(searchableText)
  const coveredRanges = [
    ...collectEvidenceWindows(searchableText, PRICE_EVIDENCE_MARKERS, 'price'),
    ...collectEvidenceWindows(searchableText, LIFECYCLE_EVIDENCE_MARKERS, 'lifecycle'),
  ]

  const sections: string[] = []

  if (content.title) sections.push(`Page title: ${content.title}`)
  if (content.metaDescription) sections.push(`Meta description: ${content.metaDescription}`)
  if (content.jsonLdText) sections.push(`Structured data: ${content.jsonLdText}`)

  for (const window of evidence.price) {
    sections.push(`Price evidence: ${window}`)
  }
  for (const window of evidence.lifecycle) {
    sections.push(`Lifecycle evidence: ${window}`)
  }

  let prepared = sections.join('\n\n')
  const remaining = maxChars - prepared.length
  const hasEvidence = evidence.price.length > 0 || evidence.lifecycle.length > 0

  if (remaining > 200 && !hasEvidence && searchableText.length > MAX_VISIBLE_BODY_CHARS) {
    const summary = buildFallbackPageSummary(searchableText, coveredRanges, remaining - 16)
    if (summary) {
      prepared = `${prepared}\n\nPage summary: ${summary}`
    }
  }

  return prepared.slice(0, maxChars)
}

export function isNavigationBoilerplateDominated(text: string, sampleLength = 1_000): boolean {
  const evidenceOnly = text.split(/\n\nPage summary:/i)[0] ?? text
  const sample = evidenceOnly.slice(0, sampleLength).toLowerCase()
  const navSignals = [
    /\bfolding treadmills\b/g,
    /\bmenu menu\b/g,
    /\bskip to content\b/g,
    /\bshop by brand\b/g,
    /\bex-display clearance\b/g,
  ]

  let hits = 0
  for (const pattern of navSignals) {
    hits += sample.match(pattern)?.length ?? 0
  }

  return hits >= 3
}

export function extractPageContent(html: string, fallbackTitle = '', parseStartedAt = Date.now()): PageExtractedContent {
  if (Date.now() - parseStartedAt > PAGE_PARSE_BUDGET_MS) {
    return {
      title: fallbackTitle,
      metaDescription: '',
      jsonLdText: '',
      bodyText: '',
      combinedText: '',
    }
  }

  const headScan = html.slice(0, MAX_HTML_HEAD_SCAN_CHARS)
  const structuredScan = html.slice(0, MAX_HTML_STRUCTURED_SCAN_CHARS)
  const title = extractHtmlTitle(headScan) || fallbackTitle
  const metaDescription = extractMetaDescription(headScan)
  const jsonLdText = normalizeExtractedText(
    [extractJsonLdText(structuredScan), extractEmbeddedStatePriceText(structuredScan)].filter(Boolean).join(' '),
  )
  const bodyText = extractVisibleBodyText(html)
  const combinedText = normalizeExtractedText(
    [title, metaDescription, jsonLdText, bodyText].filter(Boolean).join(' '),
  )

  return {
    title,
    metaDescription,
    jsonLdText,
    bodyText,
    combinedText,
  }
}

function logPageFetchAttempt(log: PageFetchAttemptLog) {
  console.info('equipment_research_page_fetch', log)
}

async function fetchHtmlResponse(
  url: string,
  userAgent: string,
): Promise<{
  ok: boolean
  status: number
  error?: string
  html?: string
}> {
  const parsed = new URL(url.trim())
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, status: 0, error: 'Unsupported URL protocol' }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PAGE_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    })

    if (!response.ok) {
      return { ok: false, status: response.status, error: `HTTP ${response.status}` }
    }

    const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
    if (
      !contentType.includes('text/html') &&
      !contentType.includes('application/xhtml')
    ) {
      return {
        ok: false,
        status: response.status,
        error: `Non-HTML response (${contentType.split(';')[0] || 'unknown'})`,
      }
    }

    const buffer = await response.arrayBuffer()
    if (buffer.byteLength > MAX_PAGE_BYTES) {
      return { ok: false, status: response.status, error: 'too_large_html' }
    }

    const html = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
    return { ok: true, status: response.status, html }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, status: 0, error: 'Fetch timeout (10s)' }
    }

    const message = error instanceof Error ? error.message : 'Fetch failed'
    return { ok: false, status: 0, error: message }
  } finally {
    clearTimeout(timeoutId)
  }
}

function parseFetchedHtml(html: string, parseStartedAt = Date.now()): PageFetchResult {
  if (Date.now() - parseStartedAt > PAGE_PARSE_BUDGET_MS) {
    return { ok: false, error: 'parse_budget_exceeded' }
  }

  const content = extractPageContent(html, '', parseStartedAt)

  if (!content.combinedText) {
    return { ok: false, error: 'No readable page text extracted', rawHtml: html.slice(0, 4_000) }
  }

  return { ok: true, content }
}

export function extractCanonicalPageUrl(html: string, baseUrl: string): string | null {
  const ogUrl = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i)?.[1]
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1]
  const candidate = (canonical || ogUrl || '').trim()
  if (!candidate) return null

  try {
    const resolved = new URL(candidate, baseUrl)
    return resolved.toString()
  } catch {
    return null
  }
}

export async function fetchCandidatePage(url: string): Promise<PageFetchResult> {
  const parseStartedAt = Date.now()
  try {
    const initial = await fetchHtmlResponse(url, PAGE_FETCH_BOT_USER_AGENT)

    if (initial.ok && initial.html) {
      logPageFetchAttempt({
        url,
        initial_status: initial.status,
        retry_status: null,
        user_agent_used: PAGE_FETCH_BOT_USER_AGENT,
        retried_after_403: false,
      })
      const parsed = parseFetchedHtml(initial.html, parseStartedAt)
      if (parsed.ok) return parsed
      return { ok: false, error: parsed.error, rawHtml: initial.html.slice(0, 4_000) }
    }

    if (initial.status !== 403) {
      logPageFetchAttempt({
        url,
        initial_status: initial.status || null,
        retry_status: null,
        user_agent_used: PAGE_FETCH_BOT_USER_AGENT,
        retried_after_403: false,
      })
      return { ok: false, error: initial.error ?? `HTTP ${initial.status}` }
    }

    const retry = await fetchHtmlResponse(url, PAGE_FETCH_BROWSER_USER_AGENT)
    logPageFetchAttempt({
      url,
      initial_status: initial.status,
      retry_status: retry.status || null,
      user_agent_used: retry.ok ? PAGE_FETCH_BROWSER_USER_AGENT : PAGE_FETCH_BOT_USER_AGENT,
      retried_after_403: true,
    })

    if (retry.ok && retry.html) {
      const parsed = parseFetchedHtml(retry.html, parseStartedAt)
      if (parsed.ok) return parsed
      return { ok: false, error: parsed.error, rawHtml: retry.html.slice(0, 4_000) }
    }

    return { ok: false, error: retry.error ?? initial.error ?? 'HTTP 403' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fetch failed'
    return { ok: false, error: message }
  }
}

export async function fetchCandidatePages(
  urls: string[],
): Promise<Map<string, PageFetchResult>> {
  const uniqueUrls = [...new Set(urls.filter(Boolean))].slice(0, MAX_PAGES_TO_FETCH)
  const results = new Map<string, PageFetchResult>()

  for (let index = 0; index < uniqueUrls.length; index += PAGE_FETCH_CONCURRENCY) {
    const batch = uniqueUrls.slice(index, index + PAGE_FETCH_CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map(async (url) => [url, await fetchCandidatePage(url)] as const),
    )

    for (const [url, result] of batchResults) {
      results.set(url, result)
    }
  }

  return results
}

function decodePdfEscape(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
}

export function extractBasicPdfText(buffer: ArrayBuffer, maxScanChars = MAX_PDF_SCAN_CHARS): string {
  const raw = new TextDecoder('latin1').decode(buffer.slice(0, Math.min(buffer.byteLength, MAX_PDF_BYTES)))
  const scan = raw.slice(0, maxScanChars)
  const lowerScan = scan.toLowerCase()
  const windows: string[] = []

  for (const needle of RESEARCH_KEYWORD_NEEDLES) {
    let position = 0
    let found = 0

    while (found < MAX_KEYWORD_WINDOWS_PER_NEEDLE) {
      const index = lowerScan.indexOf(needle, position)
      if (index === -1) break

      const start = Math.max(0, index - KEYWORD_WINDOW_BEFORE)
      const end = Math.min(scan.length, index + needle.length + KEYWORD_WINDOW_AFTER)
      const chunk = scan.slice(start, end).replace(/\s+/g, ' ').trim()
      if (chunk.length >= 2 && /[a-zA-Z0-9£$€]/.test(chunk)) {
        windows.push(chunk)
      }

      position = index + needle.length
      found += 1
    }
  }

  return normalizeExtractedText(windows.join(' '))
}

export async function fetchCandidatePdf(url: string): Promise<PageFetchResult> {
  try {
    const parsed = new URL(url.trim())
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { ok: false, error: 'Unsupported URL protocol' }
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), PAGE_FETCH_TIMEOUT_MS)

    let response: Response

    try {
      response = await fetch(parsed.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'EquipdIntelligenceBot/1.0 (admin equipment research)',
          Accept: 'application/pdf,*/*;q=0.8',
        },
        redirect: 'follow',
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` }
    }

    const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
    if (
      !contentType.includes('application/pdf')
      && !parsed.pathname.toLowerCase().endsWith('.pdf')
    ) {
      return { ok: false, error: `Non-PDF response (${contentType.split(';')[0] || 'unknown'})` }
    }

    const buffer = await response.arrayBuffer()
    if (buffer.byteLength > MAX_PDF_BYTES) {
      return { ok: false, error: 'too_large_pdf' }
    }

    const combinedText = extractBasicPdfText(buffer).slice(0, MAX_VISIBLE_BODY_CHARS)
    if (!combinedText) {
      return { ok: false, error: 'No readable PDF text extracted' }
    }

    return {
      ok: true,
      content: {
        title: '',
        metaDescription: '',
        jsonLdText: '',
        bodyText: combinedText,
        combinedText,
      },
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, error: 'Fetch timeout (10s)' }
    }

    const message = error instanceof Error ? error.message : 'PDF fetch failed'
    return { ok: false, error: message }
  }
}

export const PAGE_FETCH_LIMITS = {
  timeoutMs: PAGE_FETCH_TIMEOUT_MS,
  maxPages: MAX_PAGES_TO_FETCH,
  concurrency: PAGE_FETCH_CONCURRENCY,
}
