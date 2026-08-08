/**
 * Runtime email HTML helpers for Edge Functions and marketplace email composition.
 * Preview/build tooling may re-export from here; do not import from emails/ in Edge Functions.
 */

/**
 * Decode HTML entities that must not appear in plain-text email subjects.
 * @param {unknown} value
 */
export function normalizeEmailSubject(value) {
  return String(value ?? '')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
}

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
 * Escape user-authored text before embedding in email HTML bodies.
 * @param {unknown} value
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Plain-text message preview for emails: collapse whitespace, truncate, escape HTML.
 * @param {unknown} body
 * @param {{ maxLength?: number, emptyFallback?: string }} [options]
 */
export function formatMessagePreview(body, options = {}) {
  const maxLength = options.maxLength ?? 280
  const emptyFallback = options.emptyFallback ?? 'Sent you a photo or attachment'
  const text = String(body ?? '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) {
    return escapeHtml(emptyFallback)
  }

  const truncated = text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
  return escapeHtml(truncated)
}

/**
 * Mask an email for structured logs (keeps domain, truncates local part).
 * @param {unknown} email
 */
export function maskEmail(email) {
  const value = String(email ?? '').trim()
  const at = value.indexOf('@')
  if (at <= 0) return '[redacted]'
  const local = value.slice(0, at)
  const domain = value.slice(at + 1)
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}***@${domain}`
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
