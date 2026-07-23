import {
  buildListingBreadcrumbItems,
  buildListingBreadcrumbSchema,
} from './breadcrumbStructuredData.js'
import {
  buildListingImageAltText,
  buildListingPageSeo,
  buildListingSeoProductName,
} from './listingPageSeo.js'
import {
  buildListingPageStructuredData,
} from './listingPageStructuredData.js'
import {
  buildListingIntelligenceSummary,
  buildListingInternalLinks,
  getListingBrandPageHref,
  getListingBrowseTypeHref,
  getListingValuationHref,
  rankSimilarListingCandidates,
} from './listingDiscovery.js'
import { formatListingLocationDetail } from './listingLocation.js'
import { getSellerShopPath } from './sellerShopUrls.js'
import { isSoldListingStatus } from './listingSoldLifecycle.js'
import { getBrandDisplayName, getBrandSlug, resolveBrandRegistryEntry } from './brandCatalogueCore.js'

function parseListingDescriptionExtras(description = '') {
  const lines = (description ?? '').split('\n')
  let colour = null
  let length = null
  let width = null
  let height = null
  const bodyLines = []

  for (const line of lines) {
    const colourMatch = line.match(/^Colour:\s*(.+)$/i)
    const dimensionsMatch = line.match(/^Dimensions \(L×W×H cm\):\s*(.+)$/i)

    if (colourMatch) {
      colour = colourMatch[1].trim()
      continue
    }

    if (dimensionsMatch) {
      const parts = dimensionsMatch[1].split('×').map((part) => part.trim())
      if (parts[0] && parts[0] !== '—') length = parts[0]
      if (parts[1] && parts[1] !== '—') width = parts[1]
      if (parts[2] && parts[2] !== '—') height = parts[2]
      continue
    }

    bodyLines.push(line)
  }

  return {
    colour,
    length,
    width,
    height,
    description: bodyLines.join('\n').trim() || null,
  }
}

function formatListingDimensions({ length, width, height }) {
  const labels = []
  if (length) labels.push(`L ${length} cm`)
  if (width) labels.push(`W ${width} cm`)
  if (height) labels.push(`H ${height} cm`)
  return labels.length ? labels.join(' · ') : null
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderBreadcrumbs(items = []) {
  const parts = items.map((item, index) => {
    const label = item.label || item.name
    const href = item.href || item.path
    const isLast = index === items.length - 1
    if (isLast || !href) {
      return `<span>${escapeHtml(label)}</span>`
    }
    return `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`
  })
  return `<nav aria-label="Breadcrumb"><p>${parts.join(' <span aria-hidden="true">/</span> ')}</p></nav>`
}

function renderLinkList(links = []) {
  if (!links.length) return ''
  return `<ul>${links.map((link) => (
    `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`
  )).join('')}</ul>`
}

function renderFacts(listing) {
  const extras = parseListingDescriptionExtras(listing?.description)
  const dimensions = formatListingDimensions(extras)
  const facts = [
    listing?.brand ? ['Brand', listing.brand] : null,
    listing?.model ? ['Model', listing.model] : null,
    listing?.category?.name ? ['Category', listing.category.name] : null,
    listing?.condition ? ['Condition', String(listing.condition).replace(/_/g, ' ')] : null,
    listing?.rating ? ['Usage rating', listing.rating] : null,
    formatListingLocationDetail(listing) ? ['Location', formatListingLocationDetail(listing)] : null,
    listing?.manufacture_year ? ['Manufacture year', listing.manufacture_year] : null,
    extras.colour ? ['Colour', extras.colour] : null,
    dimensions ? ['Dimensions', dimensions] : null,
  ].filter(Boolean)

  if (!facts.length) return ''
  return `<dl>${facts.map(([label, value]) => (
    `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
  )).join('')}</dl>`
}

function renderGallery(listing, imageAlt) {
  const images = listing?.listing_images ?? []
  if (!images.length) {
    return '<section aria-label="Listing photos"><p>No photos available.</p></section>'
  }

  const [primary, ...rest] = images
  return `
<section aria-label="Listing photos">
  <figure>
    <img
      src="${escapeHtml(primary.url)}"
      alt="${escapeHtml(imageAlt)}"
      style="width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;border-radius:12px"
      fetchpriority="high"
    />
  </figure>
  ${rest.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:0.75rem">
    ${rest.map((image, index) => (
      `<img
        src="${escapeHtml(image.url)}"
        alt="${escapeHtml(buildListingImageAltText(listing, { photoIndex: index + 1 }))}"
        loading="lazy"
        style="width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;border-radius:10px"
      />`
    )).join('')}
  </div>` : ''}
</section>`.trim()
}

function renderSellerSection(sellerProfile) {
  const shopPath = sellerProfile ? getSellerShopPath(sellerProfile) : null
  const displayName = sellerProfile?.username || sellerProfile?.display_name || 'Seller'
  return `
<section aria-labelledby="seo-listing-seller">
  <h2 id="seo-listing-seller">Seller</h2>
  <p>${escapeHtml(displayName)}</p>
  ${shopPath ? `<p><a href="${escapeHtml(shopPath)}">View seller profile</a></p>` : ''}
</section>`.trim()
}

function renderIntelligenceSection(listing, equipmentProduct) {
  const summary = buildListingIntelligenceSummary(listing, equipmentProduct)
  if (!summary) return ''
  return `
<section aria-labelledby="seo-listing-intelligence">
  <h2 id="seo-listing-intelligence">About this equipment</h2>
  <p>${escapeHtml(summary.disclaimer)}</p>
  <dl>${summary.fields.map((field) => (
    `<div><dt>${escapeHtml(field.label)}</dt><dd>${escapeHtml(field.value)}${
      field.note ? ` <span>${escapeHtml(field.note)}</span>` : ''
    }</dd></div>`
  )).join('')}</dl>
  <p>
    ${summary.equipmentHref ? `<a href="${escapeHtml(summary.equipmentHref)}">View full product information</a>` : ''}
    ${summary.valuationHref ? ` · <a href="${escapeHtml(summary.valuationHref)}">Value this equipment</a>` : ''}
    ${summary.brandHref ? ` · <a href="${escapeHtml(summary.brandHref)}">More from this brand</a>` : ''}
  </p>
</section>`.trim()
}

function buildSimilarLinks(listing, equipmentProduct, activeListings = []) {
  const siblingProductIds = new Set(
    (equipmentProduct?.sibling_product_ids ?? []).filter(Boolean),
  )
  return rankSimilarListingCandidates(
    activeListings,
    {
      listingId: listing?.id,
      equipmentProductId: listing?.equipment_product_id || equipmentProduct?.id || null,
      siblingProductIds,
      brand: listing?.brand || equipmentProduct?.brand || null,
      categoryId: listing?.category_id ?? listing?.category?.id ?? null,
      equipmentType: equipmentProduct?.equipment_type || listing?.category?.name || null,
    },
    { limit: 8 },
  )
}

function renderSimilarSection(listing, equipmentProduct, activeListings) {
  const recommendations = buildSimilarLinks(listing, equipmentProduct, activeListings)
  const links = recommendations.map((candidate) => ({
    href: `/listings/${candidate.slug}`,
    label: candidate.title,
  }))
  return {
    recommendations,
    html: `
<section id="listing-similar-listings" aria-labelledby="seo-listing-similar">
  <h2 id="seo-listing-similar">You might also like</h2>
  ${links.length ? renderLinkList(links) : '<p>No similar active listings are available right now.</p>'}
</section>`.trim(),
  }
}

function renderSummaryActions(listing, equipmentProduct, similarRecommendations) {
  const sold = isSoldListingStatus(listing)
  const typeBrowseHref = getListingBrowseTypeHref(listing, equipmentProduct)
  const brandHref = getListingBrandPageHref(listing?.brand || equipmentProduct?.brand)
  const valuationHref = getListingValuationHref(listing, equipmentProduct)
  const similarHref = similarRecommendations.length
    ? '#listing-similar-listings'
    : (typeBrowseHref || brandHref || '/browse')

  if (sold) {
    return `
<div>
  <p><strong>This item has now sold</strong></p>
  <p>This listing has been completed on Equipd.</p>
  <p>
    <a href="${escapeHtml(similarHref)}">View Similar Listings</a>
    · <a href="${escapeHtml(valuationHref)}">Value This Equipment</a>
  </p>
</div>`.trim()
  }

  return `
<div>
  ${listing?.price_pence != null ? `<p><strong>Price:</strong> £${escapeHtml((Number(listing.price_pence) / 100).toFixed(0))}</p>` : ''}
  <p><a href="${escapeHtml(valuationHref)}">Value this equipment</a></p>
</div>`.trim()
}

export function buildListingSeoDocument({
  listing,
  equipmentProduct = null,
  sellerProfile = null,
  activeListings = [],
  now = new Date(),
} = {}) {
  if (!listing?.slug) return null

  const sold = isSoldListingStatus(listing)
  const seo = buildListingPageSeo({ listing, equipmentProduct, now })
  const brandName = listing?.brand || equipmentProduct?.brand || null
  const brandEntry = resolveBrandRegistryEntry(brandName)
  const brandSlug = brandEntry?.slug || (getListingBrandPageHref(brandName) ? getBrandSlug(brandName) : null)
  const brandDisplayName = brandEntry?.displayName || (brandSlug ? getBrandDisplayName(brandName) : null)
  const breadcrumbOptions = { brandSlug, brandDisplayName }
  const breadcrumbSchema = buildListingBreadcrumbSchema(listing, breadcrumbOptions)
  const bundle = buildListingPageStructuredData({
    listing,
    equipmentProduct,
    canonicalUrl: seo.canonicalUrl,
    sellerProfile,
    breadcrumbSchema,
  })
  const breadcrumbs = buildListingBreadcrumbItems(listing, breadcrumbOptions) || []
  const internalLinks = buildListingInternalLinks(listing, equipmentProduct)
  const imageAlt = seo.imageAlt || listing.title || 'Listing photo'
  const description = parseListingDescriptionExtras(listing?.description).description || 'No description provided.'
  const similar = renderSimilarSection(listing, equipmentProduct, activeListings)
  const actions = renderSummaryActions(listing, equipmentProduct, similar.recommendations)
  const categoryHref = getListingBrowseTypeHref(listing, equipmentProduct)
  const brandHref = getListingBrandPageHref(listing?.brand || equipmentProduct?.brand)
  const productName = buildListingSeoProductName(listing, equipmentProduct) || listing.title

  const bodyHtml = `
<article class="seo-prerender" data-equipd-seo-prerender="listing" data-listing-slug="${escapeHtml(listing.slug)}">
  ${renderBreadcrumbs(breadcrumbs)}
  <header>
    ${listing?.brand ? `<p>${escapeHtml(listing.brand)}</p>` : ''}
    <h1>${escapeHtml(listing.title || productName)}</h1>
    <p>${escapeHtml(seo.description)}</p>
  </header>
  <section aria-labelledby="seo-listing-summary">
    <h2 id="seo-listing-summary">${sold ? 'Sold listing' : 'Listing summary'}</h2>
    ${actions}
    ${renderFacts(listing)}
    <p>
      ${brandHref && listing?.brand ? `<a href="${escapeHtml(brandHref)}">${escapeHtml(listing.brand)}</a>` : ''}
      ${categoryHref && listing?.category?.name ? ` · <a href="${escapeHtml(categoryHref)}">${escapeHtml(listing.category.name)}</a>` : ''}
    </p>
  </section>
  ${renderGallery(listing, imageAlt)}
  <section aria-labelledby="seo-listing-description">
    <h2 id="seo-listing-description">Seller's description</h2>
    <p style="white-space:pre-wrap">${escapeHtml(description)}</p>
  </section>
  ${renderSellerSection(sellerProfile)}
  ${renderIntelligenceSection(listing, equipmentProduct)}
  ${similar.html}
  ${internalLinks.length ? `<section aria-labelledby="seo-listing-links"><h2 id="seo-listing-links">Related on Equipd</h2>${renderLinkList(internalLinks)}</section>` : ''}
</article>`.trim()

  return {
    path: seo.canonicalPath,
    title: seo.titleWithSite,
    description: seo.description,
    canonicalPath: seo.canonicalPath,
    robots: seo.robotsContent,
    openGraph: seo.openGraph,
    jsonLd: bundle.jsonLd,
    bodyHtml,
    headLinks: seo.socialImage ? [{ rel: 'preload', as: 'image', href: seo.socialImage, fetchPriority: 'high' }] : [],
  }
}
