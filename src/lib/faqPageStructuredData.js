/**
 * Shared Schema.org FAQPage builders for equipment guide pages.
 * FAQ content must come from the same visible FAQ array used by EquipmentProductFaqSection.
 * Reuses EQUIPD_SITE_ORIGIN — do not introduce a second site-origin constant.
 */

import { EQUIPD_SITE_ORIGIN } from './brandCatalogueCore.js'
import { normalizeEquipmentProductFaqEntries } from './equipmentProductContentPage.js'

/** Matches siteStructuredData.SITE_SCHEMA_ATTR without importing that module (avoids cycles). */
export const SITE_SCHEMA_ATTR = 'data-equipd-schema'

export const FAQ_SCHEMA_KEY = 'faq'

const PLACEHOLDER_ANSWER_PATTERN = /^(tbd|todo|n\/?a|none|null|undefined|placeholder|coming soon|lorem ipsum[.!]*)\s*$/i
const URL_ONLY_PATTERN = /^https?:\/\/\S+$/i

export function absoluteFaqCanonicalUrl(pathOrUrl = '/') {
  const raw = String(pathOrUrl ?? '').trim()
  if (!raw) return `${EQUIPD_SITE_ORIGIN}/`

  try {
    const parsed = /^https?:\/\//i.test(raw)
      ? new URL(raw)
      : new URL(raw.startsWith('/') ? raw : `/${raw}`, EQUIPD_SITE_ORIGIN)

    let pathname = parsed.pathname || '/'
    if (pathname !== '/' && pathname.endsWith('/')) {
      pathname = pathname.replace(/\/+$/, '')
    }

    if (pathname === '/') return `${EQUIPD_SITE_ORIGIN}/`
    return `${EQUIPD_SITE_ORIGIN}${pathname}`
  } catch {
    return `${EQUIPD_SITE_ORIGIN}/`
  }
}

function stripHtmlToText(value) {
  return String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function isExcludedFaqItem(entry) {
  const question = entry.question
  const answer = entry.answer
  if (!question || !answer) {
    return { exclude: true, reason: 'empty question or answer' }
  }
  if (question.toLowerCase() === answer.toLowerCase()) {
    return { exclude: true, reason: 'question equals answer' }
  }
  if (PLACEHOLDER_ANSWER_PATTERN.test(answer)) {
    return { exclude: true, reason: 'placeholder answer' }
  }
  if (URL_ONLY_PATTERN.test(answer)) {
    return { exclude: true, reason: 'url-only answer' }
  }
  return { exclude: false, reason: null }
}

/**
 * Normalize FAQ entries for schema from the same source as the visible FAQ section.
 * Applies quality guards (empty, duplicate, placeholder, URL-only) without rewriting wording.
 *
 * @returns {{ items: Array<{ question: string, answer: string }>, excluded: Array<{ question: string, reason: string }> }}
 */
export function normalizeFaqItems(faqs = []) {
  const base = normalizeEquipmentProductFaqEntries(
    Array.isArray(faqs)
      ? faqs.map((entry) => ({
        question: stripHtmlToText(entry?.question ?? entry?.name),
        answer: stripHtmlToText(entry?.answer ?? entry?.text ?? entry?.acceptedAnswer?.text),
      }))
      : [],
  )

  const items = []
  const excluded = []
  const seenQuestions = new Set()

  for (const entry of base) {
    const guard = isExcludedFaqItem(entry)
    if (guard.exclude) {
      excluded.push({ question: entry.question, reason: guard.reason })
      continue
    }

    const key = entry.question.toLowerCase()
    if (seenQuestions.has(key)) {
      excluded.push({ question: entry.question, reason: 'duplicate question' })
      continue
    }
    seenQuestions.add(key)
    items.push(entry)
  }

  return { items, excluded }
}

/**
 * Build FAQPage JSON-LD from visible FAQ entries.
 * Returns null when no eligible FAQs remain.
 */
export function buildFaqPageSchema(faqs, { canonicalUrl = null } = {}) {
  const { items, excluded } = normalizeFaqItems(faqs)
  if (!items.length) {
    return null
  }

  const pageUrl = absoluteFaqCanonicalUrl(canonicalUrl)
  return {
    schema: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${pageUrl}#faq`,
      mainEntity: items.map((entry) => ({
        '@type': 'Question',
        name: entry.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: entry.answer,
        },
      })),
    },
    items,
    excluded,
  }
}

/** Convenience: schema object only (or null). */
export function buildFaqPageSchemaNode(faqs, options = {}) {
  return buildFaqPageSchema(faqs, options)?.schema || null
}

function escapeJsonForHtmlScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export function renderFaqPageScriptTag(schema) {
  if (!schema || schema['@type'] !== 'FAQPage') return ''
  return [
    `<script type="application/ld+json" ${SITE_SCHEMA_ATTR}="${FAQ_SCHEMA_KEY}">`,
    escapeJsonForHtmlScript(schema),
    '</script>',
  ].join('')
}

export function findFaqPageSchemas(nodes = []) {
  const list = Array.isArray(nodes) ? nodes : [nodes]
  return list.filter((node) => node && node['@type'] === 'FAQPage')
}

export function excludeFaqPageSchemas(nodes = []) {
  const list = Array.isArray(nodes) ? nodes : [nodes]
  return list.filter((node) => node && node['@type'] !== 'FAQPage')
}

/**
 * Idempotently ensure a single FAQPage script exists for the given schema.
 */
export function syncFaqPageSchemaInDocument(doc, schema) {
  if (!doc?.head) return null
  const selector = `script[${SITE_SCHEMA_ATTR}="${FAQ_SCHEMA_KEY}"]`
  const existing = [...doc.head.querySelectorAll(selector)]

  if (!schema) {
    for (const node of existing) node.remove()
    return null
  }

  const expectedId = schema['@id']
  const matching = existing.filter((node) => {
    try {
      const raw = node.textContent || node.text || ''
      return JSON.parse(raw)['@id'] === expectedId
        && raw === JSON.stringify(schema)
    } catch {
      return false
    }
  })

  if (matching.length === 1 && existing.length === 1) {
    return matching[0]
  }

  for (const node of existing) node.remove()

  const script = doc.createElement('script')
  script.type = 'application/ld+json'
  script.setAttribute(SITE_SCHEMA_ATTR, FAQ_SCHEMA_KEY)
  const serialized = JSON.stringify(schema)
  script.text = serialized
  script.textContent = serialized
  doc.head.appendChild(script)
  return script
}
