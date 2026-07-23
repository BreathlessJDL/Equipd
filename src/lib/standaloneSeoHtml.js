import { injectSiteStructuredDataIntoHtml } from './siteStructuredData.js'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderOpenGraphTags(openGraph = {}) {
  return Object.entries(openGraph)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => {
      if (key.startsWith('twitter:')) {
        return `<meta name="${escapeHtml(key)}" content="${escapeHtml(value)}" />`
      }
      return `<meta property="${escapeHtml(key)}" content="${escapeHtml(value)}" />`
    })
    .join('\n    ')
}

function renderHeadLinks(links = []) {
  if (!Array.isArray(links) || !links.length) return ''
  return links
    .filter((link) => link?.rel && link?.href)
    .map((link) => {
      const attrs = [
        `rel="${escapeHtml(link.rel)}"`,
        link.as ? `as="${escapeHtml(link.as)}"` : '',
        `href="${escapeHtml(link.href)}"`,
        link.type ? `type="${escapeHtml(link.type)}"` : '',
        link.fetchPriority ? `fetchpriority="${escapeHtml(link.fetchPriority)}"` : '',
        link.crossOrigin ? `crossorigin="${escapeHtml(link.crossOrigin === true ? '' : link.crossOrigin)}"` : '',
      ].filter(Boolean).join(' ')
      return `<link ${attrs} />`
    })
    .join('\n    ')
}

function renderJsonLd(data) {
  if (!data) return ''
  const payload = Array.isArray(data) ? data.filter(Boolean) : [data]
  return payload
    .map((entry) => `<script type="application/ld+json">${JSON.stringify(entry).replace(/</g, '\\u003c')}</script>`)
    .join('\n    ')
}

export function buildStandaloneSeoHtml(document) {
  if (!document) {
    throw new Error('buildStandaloneSeoHtml requires a document')
  }

  const absoluteCanonical = document.canonicalPath?.startsWith('http')
    ? document.canonicalPath
    : `https://www.equipd.co.uk${String(document.canonicalPath || '/').startsWith('/') ? document.canonicalPath || '/' : `/${document.canonicalPath || ''}`}`

  const headExtras = [
    '<meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `<title>${escapeHtml(document.title)}</title>`,
    `<meta name="description" content="${escapeHtml(document.description)}" />`,
    document.robots ? `<meta name="robots" content="${escapeHtml(document.robots)}" />` : '',
    `<link rel="canonical" href="${escapeHtml(absoluteCanonical)}" />`,
    renderHeadLinks(document.headLinks),
    renderOpenGraphTags(document.openGraph || {}),
    renderJsonLd(document.jsonLd),
    `<style>
      body{margin:0;background:#fff;color:#111;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .seo-prerender{max-width:72rem;margin:0 auto;padding:1.5rem 1rem 3rem;line-height:1.55}
      .seo-prerender img{display:block;max-width:100%}
      .seo-prerender a{color:#0b57d0}
      .seo-prerender dl{display:grid;grid-template-columns:max-content 1fr;gap:.5rem .9rem}
      .seo-prerender dl>div{display:contents}
      .seo-prerender ul{padding-left:1.25rem}
    </style>`,
  ].filter(Boolean).join('\n    ')

  return injectSiteStructuredDataIntoHtml(`<!doctype html>
<html lang="en-GB">
  <head>
    ${headExtras}
  </head>
  <body>
    <div id="root">${document.bodyHtml || ''}</div>
  </body>
</html>`)
}
