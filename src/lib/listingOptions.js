/**
 * Controlled listing taxonomy for categories, brands, and ratings.
 * Legacy DB values outside these lists are preserved and shown as-is in the UI.
 */

export const LISTING_CATEGORY_OPTIONS = [
  { label: 'Treadmills', slug: 'treadmill', sortOrder: 10 },
  { label: 'Crosstrainers', slug: 'crosstrainers', sortOrder: 20 },
  { label: 'Upright Bikes', slug: 'upright-bikes', sortOrder: 30 },
  { label: 'Recumbent Bikes', slug: 'recumbent-bikes', sortOrder: 40 },
  { label: 'Spin Bikes', slug: 'spin-bikes', sortOrder: 50 },
  { label: 'Stairclimbers', slug: 'stairclimbers', sortOrder: 60 },
  { label: 'Upper Body Bikes', slug: 'upper-body-bikes', sortOrder: 70 },
  { label: 'Assault Bikes', slug: 'assault-bike', sortOrder: 80 },
  { label: 'Plate Loaded Machines', slug: 'plate-loaded-machine', sortOrder: 90 },
  { label: 'Pin Loaded Machines', slug: 'pin-loaded-machine', sortOrder: 100 },
  { label: 'Multi-gyms', slug: 'multi-gyms', sortOrder: 110 },
  { label: 'Dual Cable Pulley', slug: 'dual-cable-pulley', sortOrder: 120 },
  { label: 'Squat Racks', slug: 'squat-rack', sortOrder: 130 },
  { label: 'Skierg', slug: 'skierg', sortOrder: 140 },
  { label: 'Rowers', slug: 'rowers', sortOrder: 145 },
  { label: 'Functional', slug: 'functional', sortOrder: 150 },
  { label: 'Benches', slug: 'bench', sortOrder: 160 },
  { label: 'Dumbbells', slug: 'dumbbells', sortOrder: 170 },
  { label: 'Weight Plates', slug: 'weight-plates', sortOrder: 180 },
  { label: 'Barbells', slug: 'barbells', sortOrder: 190 },
  { label: 'Other', slug: 'other', sortOrder: 200 },
]

export const LISTING_RATING_OPTIONS = [
  { value: 'full_commercial', label: 'Full commercial' },
  { value: 'light_commercial', label: 'Light commercial' },
  { value: 'home_use', label: 'Home use' },
]

export const LISTING_BRAND_OPTIONS = [
  'Adidas Training',
  'American Barbell',
  'Assault Fitness',
  'ATX Strength',
  'Atlantis',
  'Bells of Steel',
  'BH Fitness',
  'BodyBoss',
  'Bodycraft',
  'BodyMax',
  'BodyPower',
  'Body-Solid',
  'BOSU',
  'Bowflex',
  'CAP Barbell',
  'Concept2',
  'Cybex',
  'Decathlon (Domyos)',
  'Echelon',
  'Eleiko',
  'Everlast',
  'First Degree Fitness',
  'FluidRower',
  'Force USA',
  'Freemotion Fitness',
  'Fringe Sport',
  'Gaiam',
  'Hammer Strength',
  'Hatton',
  'Hoist Fitness',
  'Horizon Fitness',
  'Hyperice',
  'Impulse',
  'Ironmaster',
  'JFIT',
  'JK Fitness',
  'Jordan',
  'Keiser',
  'Kettler',
  'Life Fitness',
  'Manduka',
  'Marcy',
  'Matrix Fitness',
  'Mirafit',
  'Nautilus',
  'NordicTrack',
  'Octane Fitness',
  'Panatta',
  'Peloton',
  'PowerBlock',
  'Powerline',
  'Power Plate',
  'Powertec',
  'Primal',
  'Primal Fitness',
  'Primal Strength',
  'Precor',
  'ProForm',
  'Pulse',
  'Raze',
  'Reebok Fitness',
  'REP Fitness',
  'Rogue Fitness',
  'Schwinn Fitness',
  'Shua',
  'Sole Fitness',
  'Sorinex',
  'SPRI',
  'Spirit Fitness',
  'Stages Cycling',
  'StairMaster',
  'Star Trac',
  'Sunny Health & Fitness',
  'Tanita',
  'Taurus',
  'Technogym',
  'Therabody',
  'Titan Fitness',
  'TriggerPoint',
  'TRUE Fitness',
  'TrueForm',
  'TuffStuff',
  'Volta',
  'Vulcan Strength',
  'Wahoo Fitness',
  'Water Rower',
  'Watson Gym Equipment',
  'Weider',
  'Wattbike',
  'XMark Fitness',
  'Xterra Fitness',
  'York Fitness',
  'Ziva',
  'Other',
]

const CONTROLLED_CATEGORY_SLUGS = new Set(LISTING_CATEGORY_OPTIONS.map((option) => option.slug))

const RATING_LABELS = Object.fromEntries(
  LISTING_RATING_OPTIONS.map(({ value, label }) => [value, label]),
)

export function getRatingLabel(value) {
  if (!value) return null
  return RATING_LABELS[value] ?? value
}

const CATEGORY_LABELS_BY_SLUG = Object.fromEntries(
  LISTING_CATEGORY_OPTIONS.map(({ slug, label }) => [slug, label]),
)

export function getCategoryLabelBySlug(slug) {
  if (!slug) return null
  return CATEGORY_LABELS_BY_SLUG[slug] ?? null
}

export function getCategoryDisplayName(listing) {
  const slug = listing?.category?.slug
  if (slug && CATEGORY_LABELS_BY_SLUG[slug]) {
    return CATEGORY_LABELS_BY_SLUG[slug]
  }
  return listing?.category?.name ?? null
}

export function getBrandDisplayName(brand) {
  if (!brand?.trim()) return null
  return brand.trim()
}

export function buildBrandSelectOptions(currentBrand = '') {
  const trimmed = currentBrand?.trim() ?? ''
  if (trimmed && !LISTING_BRAND_OPTIONS.includes(trimmed)) {
    return [trimmed, ...LISTING_BRAND_OPTIONS]
  }
  return LISTING_BRAND_OPTIONS
}

export function buildCategorySelectOptions(dbCategories = [], currentCategoryId = '') {
  const bySlug = new Map(dbCategories.map((category) => [category.slug, category]))
  const options = LISTING_CATEGORY_OPTIONS.map((option) => {
    const match = bySlug.get(option.slug)
    if (!match) return null
    return {
      id: match.id,
      label: option.label,
      slug: option.slug,
      legacy: false,
    }
  }).filter(Boolean)

  const current = dbCategories.find((category) => category.id === currentCategoryId)
  if (current && !CONTROLLED_CATEGORY_SLUGS.has(current.slug)) {
    options.unshift({
      id: current.id,
      label: `${current.name} (legacy)`,
      slug: current.slug,
      legacy: true,
    })
  }

  return options
}

export function buildCategoryFilterOptions(dbCategories = []) {
  return buildCategorySelectOptions(dbCategories)
}
