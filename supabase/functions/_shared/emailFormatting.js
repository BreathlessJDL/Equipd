/**
 * Runtime email HTML helpers for Edge Functions and marketplace email composition.
 * Preview/build tooling may re-export from here; do not import from emails/ in Edge Functions.
 */

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
