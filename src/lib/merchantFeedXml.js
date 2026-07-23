/**
 * Google Merchant RSS 2.0 / Atom-compatible product XML (g: namespace).
 */

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function cdataSafe(value) {
  // Prevent early CDATA termination
  return String(value ?? '').replace(/]]>/g, ']] >')
}

function renderTag(name, value, { cdata = false } = {}) {
  if (value == null || value === '') return ''
  if (cdata) {
    return `      <${name}><![CDATA[${cdataSafe(value)}]]></${name}>`
  }
  return `      <${name}>${xmlEscape(value)}</${name}>`
}

export function renderMerchantFeedItemXml(item) {
  if (!item?.id) return ''

  const lines = [
    '    <item>',
    renderTag('g:id', item.id),
    renderTag('g:title', item.title, { cdata: true }),
    renderTag('g:description', item.description, { cdata: true }),
    renderTag('g:link', item.link),
    renderTag('g:image_link', item.image_link),
  ]

  for (const extra of item.additional_image_link || []) {
    lines.push(renderTag('g:additional_image_link', extra))
  }

  lines.push(
    renderTag('g:availability', item.availability),
    renderTag('g:price', item.price),
    renderTag('g:condition', item.condition),
  )

  if (item.brand) lines.push(renderTag('g:brand', item.brand, { cdata: true }))
  if (item.gtin) lines.push(renderTag('g:gtin', item.gtin))
  if (item.mpn) lines.push(renderTag('g:mpn', item.mpn, { cdata: true }))
  if (item.identifier_exists) {
    lines.push(renderTag('g:identifier_exists', item.identifier_exists))
  }

  lines.push(
    renderTag('g:google_product_category', item.google_product_category),
    renderTag('g:product_type', item.product_type, { cdata: true }),
  )

  if (item.shipping?.country && item.shipping?.price) {
    lines.push('      <g:shipping>')
    lines.push(`        <g:country>${xmlEscape(item.shipping.country)}</g:country>`)
    lines.push(`        <g:price>${xmlEscape(item.shipping.price)}</g:price>`)
    lines.push('      </g:shipping>')
  }

  if (item.shipping_label) {
    lines.push(renderTag('g:shipping_label', item.shipping_label))
  }

  lines.push(renderTag('g:adult', item.adult || 'no'))
  lines.push(renderTag('g:external_seller_id', item.external_seller_id))

  if (item.custom_label_0) lines.push(renderTag('g:custom_label_0', item.custom_label_0))
  if (item.custom_label_1) lines.push(renderTag('g:custom_label_1', item.custom_label_1))

  lines.push('    </item>')
  return lines.filter(Boolean).join('\n')
}

/**
 * Deterministic XML document. Items should already be sorted by id.
 */
export function buildMerchantFeedXml(items = [], {
  title = 'Equipd Marketplace Product Feed',
  link = 'https://www.equipd.co.uk/',
  description = 'Active eligible used gym equipment listings on Equipd (free listings readiness).',
  generatedAt = new Date(),
} = {}) {
  const sorted = [...items].sort((a, b) => String(a.id).localeCompare(String(b.id)))
  const seen = new Set()
  const unique = []
  for (const item of sorted) {
    if (!item?.id || seen.has(item.id)) continue
    seen.add(item.id)
    unique.push(item)
  }

  const generated = generatedAt instanceof Date ? generatedAt.toISOString() : String(generatedAt)

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">',
    '  <channel>',
    `    <title>${xmlEscape(title)}</title>`,
    `    <link>${xmlEscape(link)}</link>`,
    `    <description>${xmlEscape(description)}</description>`,
    `    <lastBuildDate>${xmlEscape(generated)}</lastBuildDate>`,
    ...unique.map((item) => renderMerchantFeedItemXml(item)),
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
}

export function countMerchantFeedItemsInXml(xml) {
  return (String(xml).match(/<g:id>/g) || []).length
}
