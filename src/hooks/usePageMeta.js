import { useEffect } from 'react'
import { usePageTitle } from './usePageTitle'
import { EQUIPD_SITE_ORIGIN } from '../lib/brandCatalogueCore'

function upsertMetaByKey(attrName, key, content) {
  if (!content) return { el: null, created: false }
  const selector = `meta[${attrName}="${key}"]`
  let el = document.querySelector(selector)
  const created = !el
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attrName, key)
    document.head.appendChild(el)
  }
  const previous = el.getAttribute('content') ?? ''
  el.setAttribute('content', content)
  return { el, created, previous }
}

/**
 * Sets document title, meta description, canonical, robots, and social tags.
 */
export function usePageMeta({
  title,
  description,
  canonicalPath = null,
  noIndex = false,
  openGraph = null,
} = {}) {
  usePageTitle(title)

  useEffect(() => {
    if (!description) return undefined

    const existingMeta = document.querySelector('meta[name="description"]')
    const createdMeta = !existingMeta
    const meta = existingMeta ?? document.createElement('meta')
    const previousContent = meta.getAttribute('content') ?? ''

    if (createdMeta) {
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }

    meta.setAttribute('content', description)

    return () => {
      if (createdMeta) {
        meta.remove()
      } else {
        meta.setAttribute('content', previousContent)
      }
    }
  }, [description])

  useEffect(() => {
    if (!canonicalPath && noIndex == null) return undefined

    let canonical = document.querySelector('link[rel="canonical"]')
    const createdCanonical = !canonical
    const previousCanonical = canonical?.getAttribute('href') ?? ''

    if (canonicalPath) {
      if (!canonical) {
        canonical = document.createElement('link')
        canonical.setAttribute('rel', 'canonical')
        document.head.appendChild(canonical)
      }
      const href = canonicalPath.startsWith('http')
        ? canonicalPath
        : `${EQUIPD_SITE_ORIGIN}${canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`}`
      canonical.setAttribute('href', href)
    }

    let robots = document.querySelector('meta[name="robots"]')
    const createdRobots = !robots
    const previousRobots = robots?.getAttribute('content') ?? ''

    if (noIndex != null) {
      if (!robots) {
        robots = document.createElement('meta')
        robots.setAttribute('name', 'robots')
        document.head.appendChild(robots)
      }
      robots.setAttribute('content', noIndex ? 'noindex, follow' : 'index, follow')
    }

    return () => {
      if (canonicalPath) {
        if (createdCanonical) canonical?.remove()
        else if (canonical) canonical.setAttribute('href', previousCanonical)
      }
      if (noIndex != null) {
        if (createdRobots) robots?.remove()
        else if (robots) robots.setAttribute('content', previousRobots)
      }
    }
  }, [canonicalPath, noIndex])

  useEffect(() => {
    if (!openGraph || typeof openGraph !== 'object') return undefined

    const managed = []

    for (const [key, value] of Object.entries(openGraph)) {
      if (!value) continue
      if (key.startsWith('twitter:')) {
        managed.push(upsertMetaByKey('name', key, value))
      } else {
        managed.push(upsertMetaByKey('property', key, value))
      }
    }

    return () => {
      for (const entry of managed) {
        if (!entry?.el) continue
        if (entry.created) entry.el.remove()
        else entry.el.setAttribute('content', entry.previous)
      }
    }
  }, [openGraph])
}
