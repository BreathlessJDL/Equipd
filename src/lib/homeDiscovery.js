import { LOCATION_PAGES } from './locations'

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
  { label: 'Life Fitness', value: 'Life Fitness' },
  { label: 'Technogym', value: 'Technogym' },
  { label: 'Precor', value: 'Precor' },
  { label: 'Matrix', value: 'Matrix Fitness' },
  { label: 'Cybex', value: 'Cybex' },
  { label: 'Hammer Strength', value: 'Hammer Strength' },
  { label: 'Rogue', value: 'Rogue Fitness' },
  { label: 'Concept2', value: 'Concept2' },
  { label: 'Eleiko', value: 'Eleiko' },
  { label: 'Jordan', value: 'Jordan' },
  { label: 'Nautilus', value: 'Nautilus' },
  { label: 'Body-Solid', value: 'Body-Solid' },
]

export function getBrowseBrandHref(brand) {
  return `/browse?brand=${encodeURIComponent(brand)}`
}
