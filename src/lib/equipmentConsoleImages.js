/**
 * Canonical public URL resolver for equipment console images.
 *
 * Canonical static path format:
 *   /equipment-console-images/{brand-slug}/normalized/{filename}
 *
 * Also accepts:
 * - absolute http(s) URLs (passed through)
 * - storage-style paths without a leading slash
 *   (equipment-console-images/{brand-slug}/normalized/{filename})
 * - legacy relative public paths under /equipment-console-images/
 *
 * Returns null for empty or invalid inputs. Does not create signed URLs.
 */

export const EQUIPMENT_CONSOLE_IMAGE_PUBLIC_PREFIX = '/equipment-console-images/'

const ABSOLUTE_URL_RE = /^https?:\/\//i

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function safeDecodeUriComponent(value) {
  const text = String(value ?? '')
  if (!text.includes('%')) return text
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

/**
 * Encode a site-relative path without double-encoding.
 * Preserves leading slash and path separators.
 */
export function encodeEquipmentConsolePublicPath(pathname) {
  const raw = String(pathname ?? '').trim()
  if (!raw) return null

  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`
  const decoded = safeDecodeUriComponent(withLeadingSlash)
  // encodeURI keeps `/` and encodes spaces / unicode in filenames.
  return encodeURI(decoded)
}

export function isAbsoluteHttpUrl(value) {
  return ABSOLUTE_URL_RE.test(String(value ?? '').trim())
}

export function isEquipmentConsolePublicPath(value) {
  const text = normalizeWhitespace(value)
  if (!text) return false
  if (text.startsWith(EQUIPMENT_CONSOLE_IMAGE_PUBLIC_PREFIX)) return true
  if (text.startsWith('equipment-console-images/')) return true
  if (isAbsoluteHttpUrl(text)) {
    try {
      return new URL(text).pathname.includes('/equipment-console-images/')
    } catch {
      return false
    }
  }
  return false
}

/**
 * Convert storage-style or absolute console image references into a
 * site-relative `/equipment-console-images/...` path when possible.
 */
export function normalizeEquipmentConsolePublicPath(value) {
  const text = normalizeWhitespace(value)
  if (!text) return null

  if (isAbsoluteHttpUrl(text)) {
    try {
      const pathname = new URL(text).pathname
      const marker = '/equipment-console-images/'
      const idx = pathname.indexOf(marker)
      if (idx === -1) return null
      return encodeEquipmentConsolePublicPath(pathname.slice(idx))
    } catch {
      return null
    }
  }

  if (text.startsWith(EQUIPMENT_CONSOLE_IMAGE_PUBLIC_PREFIX)) {
    return encodeEquipmentConsolePublicPath(text)
  }

  if (text.startsWith('equipment-console-images/')) {
    return encodeEquipmentConsolePublicPath(`/${text}`)
  }

  return null
}

/**
 * Resolve a browser-loadable console image URL for public rendering.
 *
 * @param {string|{image_url?: string|null, image_storage_path?: string|null}|null|undefined} input
 * @returns {string|null}
 */
export function resolveEquipmentConsoleImageUrl(input) {
  if (input == null) return null

  let imageUrl = null
  let storagePath = null

  if (typeof input === 'string') {
    imageUrl = normalizeWhitespace(input)
  } else if (typeof input === 'object') {
    imageUrl = normalizeWhitespace(input.image_url)
    storagePath = normalizeWhitespace(input.image_storage_path)
  } else {
    return null
  }

  if (imageUrl) {
    if (isAbsoluteHttpUrl(imageUrl)) {
      // Pass absolute URLs through unchanged (including non-static hosts).
      try {
        const parsed = new URL(imageUrl)
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          // Prefer normalised static path when the absolute URL already points
          // at our public console-image convention.
          const normalised = normalizeEquipmentConsolePublicPath(imageUrl)
          return normalised || imageUrl
        }
      } catch {
        return null
      }
      return null
    }

    const fromImageUrl = normalizeEquipmentConsolePublicPath(imageUrl)
    if (fromImageUrl) return fromImageUrl

    // Allow other site-relative public assets (legacy), but reject bare junk.
    if (imageUrl.startsWith('/') && !imageUrl.startsWith('//')) {
      return encodeEquipmentConsolePublicPath(imageUrl)
    }

    return null
  }

  if (storagePath) {
    return normalizeEquipmentConsolePublicPath(storagePath)
  }

  return null
}

/**
 * Validate an admin-entered console image path/URL before save.
 * Does not hit the network.
 */
export function validateEquipmentConsoleImagePath(value) {
  const text = normalizeWhitespace(value)
  if (!text) {
    return { ok: true, resolvedUrl: null, error: null }
  }

  const resolvedUrl = resolveEquipmentConsoleImageUrl(text)
  if (!resolvedUrl) {
    return {
      ok: false,
      resolvedUrl: null,
      error: 'Enter an absolute https URL or a path under /equipment-console-images/.',
    }
  }

  if (
    !isAbsoluteHttpUrl(resolvedUrl)
    && !resolvedUrl.startsWith(EQUIPMENT_CONSOLE_IMAGE_PUBLIC_PREFIX)
  ) {
    return {
      ok: false,
      resolvedUrl,
      error: 'Preferred format: /equipment-console-images/{brand}/normalized/{filename}',
    }
  }

  return { ok: true, resolvedUrl, error: null }
}
