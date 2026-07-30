/**
 * Shared helpers for SEO category landing pages (Node-safe).
 */

import { EQUIPD_SITE_ORIGIN, getBrandPagePath, getBrandLogoMeta } from './brandCatalogueCore.js'
import { buildBreadcrumbSchema } from './breadcrumbStructuredData.js'
import {
  buildFaqPageSchemaNode,
  normalizeFaqItems,
  renderFaqPageScriptTag,
} from './faqPageStructuredData.js'
import { EQUIPD_ORGANIZATION_ID } from './siteStructuredData.js'
import { BUY_USED_GYM_EQUIPMENT_OG_IMAGE } from './buyUsedGymEquipmentPage.js'

export function buildFeaturedBrands(slugs = [], directoryBrands = []) {
  const bySlug = new Map((directoryBrands || []).map((brand) => [brand.slug, brand]))

  return slugs.map((slug) => {
    const fromDirectory = bySlug.get(slug)
    const logoMeta = getBrandLogoMeta(slug)
    return {
      slug,
      displayName: fromDirectory?.displayName || logoMeta?.displayName || slug,
      href: getBrandPagePath(slug),
      logoPath: fromDirectory?.logoPath || logoMeta?.logoPath || null,
      logoAlt: fromDirectory?.logoAlt || logoMeta?.logoAlt || null,
      logoScale: fromDirectory?.logoScale ?? logoMeta?.logoScale ?? 1,
      listingCount: fromDirectory?.listingCount ?? 0,
      productCount: fromDirectory?.productCount ?? 0,
    }
  })
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderFaqSectionHtml(faqs = []) {
  const { items } = normalizeFaqItems(faqs)
  if (!items.length) return ''
  return items
    .map(
      (entry) => `<details>
      <summary>${escapeHtml(entry.question)}</summary>
      <p>${escapeHtml(entry.answer)}</p>
    </details>`,
    )
    .join('\n    ')
}

/**
 * @param {object} content — normalised landing page content module exports
 */
export function buildCategoryLandingOpenGraph(content) {
  const pageUrl = `${EQUIPD_SITE_ORIGIN}${content.path}`
  const og = content.ogImage || BUY_USED_GYM_EQUIPMENT_OG_IMAGE
  const imageUrl = `${EQUIPD_SITE_ORIGIN}${og.src}`
  return {
    'og:type': 'website',
    'og:site_name': 'Equipd',
    'og:locale': 'en_GB',
    'og:url': pageUrl,
    'og:title': content.pageTitle || content.metaTitle,
    'og:description': content.metaDescription,
    'og:image': imageUrl,
    'og:image:width': String(og.width),
    'og:image:height': String(og.height),
    'og:image:alt': og.alt,
    'twitter:card': 'summary_large_image',
    'twitter:title': content.pageTitle || content.metaTitle,
    'twitter:description': content.metaDescription,
    'twitter:image': imageUrl,
  }
}

export function buildCategoryLandingBreadcrumbSchema(content) {
  const crumbs = (content.breadcrumbs || [{ name: content.h1, item: content.path }]).map(
    (crumb) => ({ name: crumb.name, item: crumb.item }),
  )
  return buildBreadcrumbSchema([{ name: 'Home', item: '/' }, ...crumbs], {
    canonicalUrl: content.path,
  })
}

export function buildCategoryLandingWebPageSchema(content) {
  const pageUrl = `${EQUIPD_SITE_ORIGIN}${content.path}`
  const og = content.ogImage || BUY_USED_GYM_EQUIPMENT_OG_IMAGE
  const imageUrl = `${EQUIPD_SITE_ORIGIN}${og.src}`
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: content.pageTitle || content.metaTitle,
    headline: content.h1,
    description: content.metaDescription,
    inLanguage: 'en-GB',
    isPartOf: { '@id': `${EQUIPD_SITE_ORIGIN}/#website` },
    about: {
      '@type': 'Thing',
      name: content.schemaAbout || content.h1,
    },
    significantLink: (content.significantLinks || []).map(
      (path) => `${EQUIPD_SITE_ORIGIN}${String(path).split('?')[0]}`,
    ),
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: imageUrl,
      width: og.width,
      height: og.height,
    },
    image: [imageUrl],
    publisher: { '@id': EQUIPD_ORGANIZATION_ID },
  }
}

export function buildCategoryLandingCollectionSchema(content) {
  const pageUrl = `${EQUIPD_SITE_ORIGIN}${content.path}`
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${pageUrl}#collection`,
    url: pageUrl,
    name: content.h1,
    description: content.metaDescription,
    isPartOf: { '@id': `${pageUrl}#webpage` },
    about: {
      '@type': 'Thing',
      name: content.schemaAbout || content.h1,
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: (content.categories || []).map((category, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: category.label,
        url: `${EQUIPD_SITE_ORIGIN}${category.to}`,
      })),
    },
  }
}

export function buildCategoryLandingFaqSchema(content) {
  return buildFaqPageSchemaNode([...(content.faqItems || [])], {
    canonicalUrl: content.path,
  })
}

export function buildCategoryLandingSeoDocument(content) {
  const categoryLinks = (content.categories || [])
    .map(
      (category) =>
        `<li><a href="${escapeHtml(category.to)}">${escapeHtml(category.label)}</a> — ${escapeHtml(category.description)}</li>`,
    )
    .join('')

  const brandLinks = (content.featuredBrandSlugs || [])
    .map((slug) => {
      const meta = getBrandLogoMeta(slug)
      const name = meta?.displayName || slug
      return `<li><a href="${escapeHtml(getBrandPagePath(slug))}">${escapeHtml(name)}</a></li>`
    })
    .join('')

  const exploreLinks = (content.exploreLinks || [])
    .map(
      (link) =>
        `<li><a href="${escapeHtml(link.to)}">${escapeHtml(link.label)}</a> — ${escapeHtml(link.description)}</li>`,
    )
    .join('')

  const benefits = (content.benefits || [])
    .map((item) => `<li><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></li>`)
    .join('')

  const guideSections = (content.guideSections || [])
    .map((section) => {
      const paragraphs = section.paragraphs
        .map((text) => `<p>${escapeHtml(text)}</p>`)
        .join('\n      ')
      return `<section aria-labelledby="seo-guide-${escapeHtml(section.id)}">
      <h3 id="seo-guide-${escapeHtml(section.id)}">${escapeHtml(section.heading)}</h3>
      ${paragraphs}
    </section>`
    })
    .join('\n    ')

  const faqHtml = renderFaqSectionHtml(content.faqItems || [])
  const { items: faqItems } = normalizeFaqItems([...(content.faqItems || [])])
  const prerenderId = content.prerenderId || content.path.replace(/^\//, '')

  const crumbTrail = (content.breadcrumbs || [{ name: content.h1, item: content.path }])
    .map((crumb) => `<li><a href="${escapeHtml(crumb.item)}">${escapeHtml(crumb.name)}</a></li>`)
    .join('\n      ')

  const bodyHtml = `
<article class="seo-prerender" data-equipd-seo-prerender="${escapeHtml(prerenderId)}">
  <nav aria-label="Breadcrumb">
    <ol>
      <li><a href="/">Home</a></li>
      ${crumbTrail}
    </ol>
  </nav>
  <header>
    <p>${escapeHtml(content.eyebrow)}</p>
    <h1>${escapeHtml(content.h1)}</h1>
    <p>${escapeHtml(content.lead)}</p>
    <p>
      <a href="${escapeHtml(content.primaryCta.to)}">${escapeHtml(content.primaryCta.label)}</a>
      · <a href="${escapeHtml(content.secondaryCta.to)}">${escapeHtml(content.secondaryCta.label)}</a>
    </p>
  </header>
  <section aria-labelledby="seo-listings-heading">
    <h2 id="seo-listings-heading">${escapeHtml(content.listingsHeading)}</h2>
    <p>${escapeHtml(content.listingsLead)}</p>
    <p><a href="${escapeHtml(content.browsePath)}">${escapeHtml(content.listingsCta)}</a></p>
  </section>
  <section aria-labelledby="seo-categories-heading">
    <h2 id="seo-categories-heading">${escapeHtml(content.categoryHeading)}</h2>
    <p>${escapeHtml(content.categoryLead)}</p>
    <ul>${categoryLinks}</ul>
  </section>
  <section aria-labelledby="seo-brands-heading">
    <h2 id="seo-brands-heading">${escapeHtml(content.brandHeading)}</h2>
    <p>${escapeHtml(content.brandLead)}</p>
    <ul>${brandLinks}</ul>
  </section>
  <section aria-labelledby="seo-benefits-heading">
    <h2 id="seo-benefits-heading">${escapeHtml(content.benefitsHeading)}</h2>
    <ul>${benefits}</ul>
  </section>
  <section aria-labelledby="seo-valuation-heading">
    <h2 id="seo-valuation-heading">${escapeHtml(content.valuationHeading)}</h2>
    <p>${escapeHtml(content.valuationCopy)}</p>
    <p><a href="${escapeHtml(content.secondaryCta.to)}">Get a free valuation</a></p>
  </section>
  <section aria-labelledby="seo-guide-heading">
    <p>${escapeHtml(content.guideNote)}</p>
    <h2 id="seo-guide-heading">${escapeHtml(content.guideHeading)}</h2>
    <p>${escapeHtml(content.guideIntro)}</p>
    ${guideSections}
  </section>
  <section aria-labelledby="seo-faq-heading">
    <h2 id="seo-faq-heading">Frequently asked questions</h2>
    <p>${escapeHtml(content.faqIntro)}</p>
    ${faqHtml}
  </section>
  <section aria-labelledby="seo-explore-heading">
    <h2 id="seo-explore-heading">${escapeHtml(content.exploreHeading)}</h2>
    <ul>${exploreLinks}</ul>
  </section>
</article>`.trim()

  return {
    path: content.path,
    title: content.pageTitle || content.metaTitle,
    description: content.metaDescription,
    canonicalPath: content.path,
    robots: 'index, follow, max-image-preview:large',
    openGraph: buildCategoryLandingOpenGraph(content),
    jsonLd: [
      buildCategoryLandingBreadcrumbSchema(content),
      buildCategoryLandingWebPageSchema(content),
      buildCategoryLandingCollectionSchema(content),
      buildFaqPageSchemaNode(faqItems, {
        canonicalUrl: `${EQUIPD_SITE_ORIGIN}${content.path}`,
      }),
    ].filter(Boolean),
    bodyHtml,
  }
}

export function renderCategoryLandingFaqScriptTag(content) {
  return renderFaqPageScriptTag(content.faqItems || [], {
    canonicalUrl: content.path,
  })
}
