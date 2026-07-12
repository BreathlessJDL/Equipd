import { LOCATION_PAGES } from './locations'
import { getBrandPagePath } from './brandCatalogueCore'

export const HOME_DISCOVERY_LOCATION_SLUGS = [
  'leeds',
  'manchester',
  'birmingham',
  'london',
  'sheffield',
  'bristol',
  'liverpool',
  'newcastle',
  'glasgow',
  'cardiff',
]

export const HOME_DISCOVERY_LOCATIONS = HOME_DISCOVERY_LOCATION_SLUGS.map((slug) => {
  const location = LOCATION_PAGES[slug]
  return {
    slug,
    label: location?.name ?? slug,
    href: `/listings/${slug}`,
  }
})

export const HOME_DISCOVERY_BRANDS = [
  { label: 'Life Fitness', value: 'Life Fitness', slug: 'life-fitness' },
  { label: 'Technogym', value: 'Technogym', slug: 'technogym' },
  { label: 'Precor', value: 'Precor', slug: 'precor' },
  { label: 'Matrix', value: 'Matrix Fitness', slug: 'matrix-fitness' },
  { label: 'Cybex', value: 'Cybex', slug: 'cybex' },
  { label: 'Hammer Strength', value: 'Hammer Strength', slug: 'hammer-strength' },
  { label: 'Pulse Fitness', value: 'Pulse Fitness', slug: 'pulse-fitness' },
  { label: 'Concept2', value: 'Concept2', slug: 'concept2' },
  { label: 'Wattbike', value: 'Wattbike', slug: 'wattbike' },
  { label: 'Woodway', value: 'Woodway', slug: 'woodway' },
]

export function getBrowseBrandHref(brand) {
  return `/browse?brand=${encodeURIComponent(brand)}`
}

export { getBrandPagePath }

export const HOME_DISCOVERY_VIEW_ALL_LOCATIONS_PATH = '/browse'
export const HOME_DISCOVERY_VIEW_ALL_BRANDS_PATH = '/brands'
