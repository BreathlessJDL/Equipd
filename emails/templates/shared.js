/** @typedef {import('./types.js').EmailTemplateDefinition} EmailTemplateDefinition */

/**
 * @param {string} baseUrl
 * @param {string} path
 */
export function appUrl(baseUrl, path) {
  const base = baseUrl.replace(/\/$/, '')
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalized}`
}

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
 * @param {Record<string, string>} rows label → value
 */
export function detailRowsHtml(rows) {
  const entries = Object.entries(rows).filter(([, value]) => value)
  if (entries.length === 0) return ''

  const cells = entries
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding: 0 0 8px 0; font-size: 14px; line-height: 1.5; color: #5c6570; vertical-align: top; width: 38%;">${label}</td>
          <td style="padding: 0 0 8px 0; font-size: 14px; line-height: 1.5; color: #0f2137; font-weight: 600; vertical-align: top;">${value}</td>
        </tr>`,
    )
    .join('')

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 16px 0 0 0;">
      ${cells}
    </table>`.trim()
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
