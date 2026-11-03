/**
 * Private seller/account routes that must never be indexed or leak listing data.
 * Node-safe. Used by the Vercel 404 handler and React fallback pages.
 */

export const PRIVATE_EDIT_LISTING_PATH_PREFIX = '/edit-listing'
export const PRIVATE_PAGE_ROBOTS = 'noindex, nofollow'
export const PRIVATE_EDIT_LISTING_TITLE = 'Page not available | Equipd'
export const PRIVATE_EDIT_LISTING_DESCRIPTION =
  'This listing editor is private to the seller and is not available on Equipd.'

export function isPrivateEditListingPath(pathname = '') {
  const path = String(pathname || '').split('?')[0]
  return path === PRIVATE_EDIT_LISTING_PATH_PREFIX
    || path.startsWith(`${PRIVATE_EDIT_LISTING_PATH_PREFIX}/`)
}

export function buildPrivateEditListingGoneDocument() {
  return {
    path: PRIVATE_EDIT_LISTING_PATH_PREFIX,
    title: PRIVATE_EDIT_LISTING_TITLE,
    description: PRIVATE_EDIT_LISTING_DESCRIPTION,
    canonicalPath: '/',
    robots: PRIVATE_PAGE_ROBOTS,
    jsonLd: [],
    bodyHtml: `<article class="seo-prerender" data-equipd-seo-prerender="private-edit-listing">
  <h1>This page is not available</h1>
  <p>Listing editing is private to the seller and cannot be opened from this address.</p>
  <p><a href="/buy-used-gym-equipment">Buy used gym equipment</a> · <a href="/browse">Browse listings</a></p>
</article>`,
  }
}

export function renderPrivateEditListingGoneHtml() {
  const document = buildPrivateEditListingGoneDocument()
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="${PRIVATE_PAGE_ROBOTS}" />
    <title>${document.title}</title>
    <meta name="description" content="${document.description}" />
  </head>
  <body>
    ${document.bodyHtml}
  </body>
</html>`
}
