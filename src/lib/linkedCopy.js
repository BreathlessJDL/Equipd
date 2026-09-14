/**
 * Linked prose helpers for SEO landing pages (Node-safe).
 *
 * A copy value may be:
 * - a plain string
 * - a segment object: { before?, link: { to, label }, after? }
 * - an array of strings and/or segment objects (for multiple links in one paragraph)
 */

/**
 * @typedef {{ to: string, label: string }} LinkedCopyHref
 * @typedef {{ before?: string, link: LinkedCopyHref, after?: string }} LinkedCopySegment
 * @typedef {string | LinkedCopySegment | Array<string | LinkedCopySegment>} LinkedCopyValue
 */

/**
 * Build a single mid-sentence link segment.
 * @param {string} before
 * @param {string} to
 * @param {string} label
 * @param {string} [after]
 * @returns {LinkedCopySegment}
 */
export function linkSeg(before, to, label, after = '') {
  return Object.freeze({
    before: before || '',
    link: Object.freeze({ to, label }),
    after: after || '',
  })
}

/**
 * Flatten linked copy to plain text (FAQ schema, keys, etc.).
 * @param {LinkedCopyValue} value
 */
export function plainTextFromLinkedCopy(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value.map((part) => plainTextFromLinkedCopy(part)).join('')
  }
  if (typeof value === 'object' && value.link) {
    return `${value.before || ''}${value.link.label || ''}${value.after || ''}`
  }
  return String(value)
}

/**
 * Escape HTML for prerender.
 * @param {unknown} value
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Render one segment/string to HTML.
 * @param {string | LinkedCopySegment} part
 */
function renderPartHtml(part) {
  if (typeof part === 'string') return escapeHtml(part)
  if (part?.link?.to && part?.link?.label) {
    return `${escapeHtml(part.before || '')}<a href="${escapeHtml(part.link.to)}">${escapeHtml(part.link.label)}</a>${escapeHtml(part.after || '')}`
  }
  return escapeHtml(plainTextFromLinkedCopy(part))
}

/**
 * Render linked copy to HTML for SEO prerender.
 * @param {LinkedCopyValue} value
 */
export function linkedCopyToHtml(value) {
  if (value == null) return ''
  if (typeof value === 'string') return escapeHtml(value)
  if (Array.isArray(value)) return value.map((part) => renderPartHtml(part)).join('')
  return renderPartHtml(value)
}

/**
 * Insert the first case-sensitive or case-insensitive match of `phrase` as a link.
 * Returns the original string when the phrase is absent (avoids forced linking).
 * @param {string} text
 * @param {string} phrase
 * @param {string} to
 * @param {string} [label]
 * @returns {LinkedCopyValue}
 */
export function linkifyOnce(text, phrase, to, label) {
  if (!text || !phrase || !to) return text
  let idx = text.indexOf(phrase)
  let matched = phrase
  if (idx === -1) {
    const lower = text.toLowerCase()
    const needle = phrase.toLowerCase()
    idx = lower.indexOf(needle)
    if (idx === -1) return text
    matched = text.slice(idx, idx + phrase.length)
  }
  const before = text.slice(0, idx)
  const after = text.slice(idx + matched.length)
  const parts = []
  if (before) parts.push(before)
  parts.push(linkSeg('', to, label || matched, ''))
  if (after) parts.push(after)
  return parts.length === 1 ? parts[0] : Object.freeze(parts)
}

/**
 * Apply multiple linkify rules once each (longest phrase first).
 * @param {string} text
 * @param {{ phrase: string, to: string, label?: string }[]} rules
 * @returns {LinkedCopyValue}
 */
export function linkifyText(text, rules = []) {
  if (!text || !rules.length) return text
  const sorted = [...rules].sort((a, b) => b.phrase.length - a.phrase.length)
  /** @type {Array<string | LinkedCopySegment>} */
  let parts = [text]
  for (const rule of sorted) {
    const next = []
    let linked = false
    for (const part of parts) {
      if (typeof part !== 'string' || linked) {
        next.push(part)
        continue
      }
      const result = linkifyOnce(part, rule.phrase, rule.to, rule.label)
      if (result === part) {
        next.push(part)
        continue
      }
      linked = true
      if (Array.isArray(result)) next.push(...result)
      else next.push(result)
    }
    parts = next
  }
  if (parts.length === 1) return parts[0]
  return Object.freeze(parts)
}

/**
 * Normalize FAQ items so schema always receives plain-text answers.
 * @param {Array<{ question: string, answer: LinkedCopyValue }>} items
 */
export function faqItemsForSchema(items = []) {
  return items.map((item) => ({
    question: item.question,
    answer: plainTextFromLinkedCopy(item.answer),
  }))
}
