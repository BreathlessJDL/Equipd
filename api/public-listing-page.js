import { createClient } from '@supabase/supabase-js'
import { loadLocalEnv } from '../scripts/lib/loadLocalEnv.mjs'
import { buildListingSeoDocument } from '../src/lib/listingSeoPrerender.js'
import {
  fetchApprovedEquipmentProductsForListings,
  fetchPublicReadableListingBySlug,
  fetchPublicSellerProfilesForListings,
} from '../src/lib/listingPrerenderData.js'
import { renderSeoDocumentHtml } from '../src/lib/spaShellHtml.js'

function getAnonSupabaseEnv() {
  const env = globalThis.process?.env ?? {}
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Missing public Supabase env for listing runtime.')
  }
  return { url, key }
}

function requestHeaders(req) {
  return req?.headers || {}
}

function buildNotFoundDocument(slug) {
  return {
    path: `/listings/${slug}`,
    title: 'Listing Not Found | Equipd',
    description: 'This listing could not be found on Equipd.',
    canonicalPath: `/listings/${slug}`,
    robots: 'noindex, follow',
    openGraph: {
      'og:type': 'website',
      'og:site_name': 'Equipd',
      'og:title': 'Listing Not Found | Equipd',
      'og:description': 'This listing could not be found on Equipd.',
      'og:url': `https://www.equipd.co.uk/listings/${slug}`,
      'twitter:card': 'summary',
      'twitter:title': 'Listing Not Found | Equipd',
      'twitter:description': 'This listing could not be found on Equipd.',
    },
    bodyHtml: `<article class="seo-prerender"><h1>Listing not found</h1><p>This listing could not be found on Equipd.</p><p><a href="/browse">Back to browse</a></p></article>`,
    jsonLd: [],
  }
}

function buildUnavailableDocument(slug) {
  return {
    path: `/listings/${slug}`,
    title: 'Listing Unavailable | Equipd',
    description: 'Equipd could not load this listing right now.',
    canonicalPath: `/listings/${slug}`,
    robots: 'noindex, follow',
    openGraph: {},
    bodyHtml:
      '<article class="seo-prerender"><h1>Listing unavailable</h1><p>Equipd could not load this listing right now.</p></article>',
    jsonLd: [],
  }
}

async function sendSeoHtml(res, status, document, req) {
  const rendered = await renderSeoDocumentHtml(document, {
    headers: requestHeaders(req),
    allowStandaloneFallback: true,
  })

  res.status(status).setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
  if (rendered.mode === 'standalone_fallback') {
    res.setHeader('X-Equipd-Listing-Html', 'standalone-fallback')
  } else {
    res.setHeader('X-Equipd-Listing-Html', 'spa-shell')
  }
  res.send(rendered.html)
}

export default async function handler(req, res) {
  const slug = String(req.query.slug ?? '').trim()
  if (!slug) {
    await sendSeoHtml(res, 404, buildNotFoundDocument(''), req)
    return
  }

  try {
    loadLocalEnv()
    const { url, key } = getAnonSupabaseEnv()
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const listing = await fetchPublicReadableListingBySlug(supabase, slug, { supabaseUrl: url })
    if (!listing) {
      await sendSeoHtml(res, 404, buildNotFoundDocument(slug), req)
      return
    }

    // Runtime path: avoid fetching the entire active catalogue just for SEO similar links.
    // React ListingDetailPage loads recommendations client-side after mount.
    const [products, profiles] = await Promise.all([
      fetchApprovedEquipmentProductsForListings(supabase, [listing]),
      fetchPublicSellerProfilesForListings(supabase, [listing]),
    ])

    const product = products.byListingId.get(listing.id) || null
    const document = buildListingSeoDocument({
      listing,
      equipmentProduct: product,
      sellerProfile: profiles.get(listing.seller_id) || null,
      activeListings: [],
    })

    await sendSeoHtml(res, 200, document, req)
  } catch {
    await sendSeoHtml(res, 500, buildUnavailableDocument(slug), req)
  }
}
