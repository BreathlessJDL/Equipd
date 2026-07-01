/** @typedef {import('./types.js').EmailTemplateDefinition} EmailTemplateDefinition */

import { appUrl, detailRowsHtml } from '../../supabase/functions/_shared/emailFormatting.js'

export { appUrl, detailRowsHtml }

/**
 * @param {string} html
 */
export function htmlToPlainText(html) {
  let text = String(html ?? '')
    .replace(
      /<tr>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<\/tr>/gi,
      '\n$1: $2',
    )
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<td[^>]*>/gi, ' ')
    .replace(/<\/td>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line, index, lines) => line || (index > 0 && lines[index - 1]))
    .join('\n')
}

/**
 * @param {Record<string, unknown>} data
 */
export function renderPlainTextEmail(data) {
  const lines = []

  if (data.title) lines.push(String(data.title))
  if (data.subtitle) lines.push(String(data.subtitle))
  if (lines.length > 0) lines.push('')

  if (data.body) {
    lines.push(htmlToPlainText(String(data.body)))
    lines.push('')
  }

  if (data.cta_text && data.cta_url) {
    lines.push(`${data.cta_text}: ${data.cta_url}`)
    lines.push('')
  }

  if (data.secondary_text && data.secondary_url) {
    lines.push(`${data.secondary_text}: ${data.secondary_url}`)
    lines.push('')
  }

  const baseUrl = String(data.base_url ?? 'https://equipd.co.uk').replace(/\/$/, '')
  lines.push('—')
  lines.push('Equipd — The UK marketplace for used gym equipment.')
  lines.push(`Help Centre: ${baseUrl}/help`)
  lines.push(`Contact Support: ${baseUrl}/support`)
  if (data.year) {
    lines.push(`© ${data.year} Equipd`)
  }

  return lines.join('\n').trim()
}

/**
 * @param {string} baseUrl
 * @param {Record<string, unknown>} overrides
 */
export function layoutDefaults(baseUrl, overrides = {}) {
  return {
    base_url: baseUrl,
    tagline: 'The UK marketplace for used gym equipment.',
    secondary_text: 'Visit the Help Centre',
    secondary_url: appUrl(baseUrl, '/help'),
    year: String(new Date().getFullYear()),
    ...overrides,
    base_url: baseUrl,
    year: String(new Date().getFullYear()),
  }
}

/** Shared SendGrid plain-text footer (Handlebars variables only). */
export function sendGridPlainTextFooter() {
  return `—
Equipd — The UK marketplace for used gym equipment.
Help Centre: {{base_url}}/help
Contact Support: {{base_url}}/support
© {{year}} Equipd`
}
