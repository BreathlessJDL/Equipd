/**
 * Product JSON-LD lifecycle helpers (markers, HTML tags, SPA sync).
 * Product field construction lives in equipmentPageSeo.buildEquipmentProductJsonLd —
 * do not create a second Product builder here.
 */

/** Matches siteStructuredData.SITE_SCHEMA_ATTR without importing that module (avoids cycles). */
export const SITE_SCHEMA_ATTR = 'data-equipd-schema'

export const PRODUCT_SCHEMA_KEY = 'product'

function escapeJsonForHtmlScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export function renderProductScriptTag(schema) {
  if (!schema || schema['@type'] !== 'Product') return ''
  return [
    `<script type="application/ld+json" ${SITE_SCHEMA_ATTR}="${PRODUCT_SCHEMA_KEY}">`,
    escapeJsonForHtmlScript(schema),
    '</script>',
  ].join('')
}

export function findProductSchemas(nodes = []) {
  const list = Array.isArray(nodes) ? nodes : [nodes]
  return list.filter((node) => node && node['@type'] === 'Product')
}

export function excludeProductSchemas(nodes = []) {
  const list = Array.isArray(nodes) ? nodes : [nodes]
  return list.filter((node) => node && node['@type'] !== 'Product')
}

/**
 * Idempotently ensure a single Product script exists for the given schema.
 */
export function syncProductSchemaInDocument(doc, schema) {
  if (!doc?.head) return null
  const selector = `script[${SITE_SCHEMA_ATTR}="${PRODUCT_SCHEMA_KEY}"]`
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
  script.setAttribute(SITE_SCHEMA_ATTR, PRODUCT_SCHEMA_KEY)
  const serialized = JSON.stringify(schema)
  script.text = serialized
  script.textContent = serialized
  doc.head.appendChild(script)
  return script
}
