export const LOCATION_PAGES = {
  leeds: {
    slug: 'leeds',
    name: 'Leeds',
    heading: 'Used gym equipment in Leeds',
    intro:
      'Browse second-hand gym kit from sellers across Leeds and nearby West Yorkshire towns. Pick up locally and save on delivery.',
    areas: ['Leeds', 'Wakefield', 'Bradford', 'Huddersfield', 'York', 'Harrogate'],
  },
  manchester: {
    slug: 'manchester',
    name: 'Manchester',
    heading: 'Used gym equipment in Manchester',
    intro:
      'Find pre-owned weights, racks, and cardio gear from sellers in Greater Manchester and surrounding towns.',
    areas: ['Manchester', 'Salford', 'Bolton', 'Stockport', 'Oldham', 'Rochdale'],
  },
  birmingham: {
    slug: 'birmingham',
    name: 'Birmingham',
    heading: 'Used gym equipment in Birmingham',
    intro:
      'Shop used gym equipment listed by sellers across Birmingham and the West Midlands commuter belt.',
    areas: ['Birmingham', 'Wolverhampton', 'Coventry', 'Solihull', 'Walsall', 'Dudley'],
  },
  london: {
    slug: 'london',
    name: 'London',
    heading: 'Used gym equipment in London',
    intro:
      'Discover used home and commercial gym equipment from sellers across London and nearby towns.',
    areas: ['London', 'Croydon', 'Wembley', 'Stratford', 'Watford', 'Romford'],
  },
  sheffield: {
    slug: 'sheffield',
    name: 'Sheffield',
    heading: 'Used gym equipment in Sheffield',
    intro:
      'Browse second-hand gym kit from sellers across Sheffield and South Yorkshire.',
    areas: ['Sheffield', 'Rotherham', 'Barnsley', 'Doncaster', 'Chesterfield'],
  },
  bristol: {
    slug: 'bristol',
    name: 'Bristol',
    heading: 'Used gym equipment in Bristol',
    intro:
      'Find pre-owned weights, racks, and cardio gear from sellers in Bristol and the South West.',
    areas: ['Bristol', 'Bath', 'Weston-super-Mare', 'Gloucester', 'Swindon'],
  },
  liverpool: {
    slug: 'liverpool',
    name: 'Liverpool',
    heading: 'Used gym equipment in Liverpool',
    intro:
      'Shop used gym equipment listed by sellers across Liverpool and Merseyside.',
    areas: ['Liverpool', 'Wirral', 'St Helens', 'Southport', 'Warrington'],
  },
  newcastle: {
    slug: 'newcastle',
    name: 'Newcastle',
    heading: 'Used gym equipment in Newcastle',
    intro:
      'Discover used gym equipment from sellers across Newcastle and the North East.',
    areas: ['Newcastle', 'Gateshead', 'Sunderland', 'Durham', 'Middlesbrough'],
  },
  glasgow: {
    slug: 'glasgow',
    name: 'Glasgow',
    heading: 'Used gym equipment in Glasgow',
    intro:
      'Browse second-hand gym kit from sellers across Glasgow and central Scotland.',
    areas: ['Glasgow', 'Paisley', 'East Kilbride', 'Hamilton', 'Stirling'],
  },
  cardiff: {
    slug: 'cardiff',
    name: 'Cardiff',
    heading: 'Used gym equipment in Cardiff',
    intro:
      'Find pre-owned gym equipment from sellers across Cardiff and South Wales.',
    areas: ['Cardiff', 'Newport', 'Swansea', 'Bridgend', 'Barry'],
  },
}

export const LOCATION_SLUGS = Object.keys(LOCATION_PAGES)

export function getLocationPage(slug) {
  return LOCATION_PAGES[slug] ?? null
}

export const LOCATION_AREA_PARAM = 'area'

export function formatLocationAreas(areas = []) {
  if (areas.length === 0) return ''
  if (areas.length === 1) return areas[0]
  if (areas.length === 2) return `${areas[0]} and ${areas[1]}`

  return `${areas.slice(0, -1).join(', ')}, and ${areas[areas.length - 1]}`
}

function normalizeAreaName(areaName) {
  return areaName.trim().toLowerCase()
}

function findAreaInRegion(region, areaName) {
  if (!region || !areaName) return null

  const normalized = normalizeAreaName(areaName)
  return region.areas.find((area) => normalizeAreaName(area) === normalized) ?? null
}

/** City-level location page slug for an area name, if one exists. */
export function getLocationSlugForArea(areaName) {
  const normalized = normalizeAreaName(areaName)
  if (!normalized) return null

  return (
    LOCATION_SLUGS.find((slug) => normalizeAreaName(LOCATION_PAGES[slug].name) === normalized) ??
    null
  )
}

export function parseLocationAreaParam(searchParams, region) {
  const raw = searchParams.get(LOCATION_AREA_PARAM)
  if (!raw?.trim() || !region) return null

  return findAreaInRegion(region, raw)
}

/**
 * Resolved view model for a location page, optionally narrowed to one nearby area.
 */
export function resolveLocationView(region, selectedArea = null) {
  const filterAreas = selectedArea ? [selectedArea] : region.areas
  const displayName = selectedArea ?? region.name
  const areaScopeText = selectedArea ? selectedArea : formatLocationAreas(region.areas)

  return {
    slug: region.slug,
    regionName: region.name,
    name: displayName,
    heading: selectedArea ? `Used gym equipment in ${selectedArea}` : region.heading,
    intro: region.intro,
    areas: region.areas,
    filterAreas,
    selectedArea,
    areaScopeText,
    sellerNearbyText:
      region.areas.length > 1 ? formatLocationAreas(region.areas.slice(1)) : region.name,
  }
}

export function isAreaPillActive(areaName, locationView) {
  const normalized = normalizeAreaName(areaName)
  if (locationView.selectedArea) {
    return normalized === normalizeAreaName(locationView.selectedArea)
  }

  return normalized === normalizeAreaName(locationView.regionName)
}

/**
 * In-location navigation for nearby-area pills (never routes to /browse).
 */
export function getAreaNavigationHref(areaName, regionSlug) {
  const dedicatedSlug = getLocationSlugForArea(areaName)
  if (dedicatedSlug && dedicatedSlug !== regionSlug) {
    return `/listings/${dedicatedSlug}`
  }

  const region = LOCATION_PAGES[regionSlug]
  if (!region) return `/listings/${regionSlug}`

  if (normalizeAreaName(areaName) === normalizeAreaName(region.name)) {
    return `/listings/${regionSlug}`
  }

  const matchedArea = findAreaInRegion(region, areaName)
  if (!matchedArea) return `/listings/${regionSlug}`

  return `/listings/${regionSlug}?${LOCATION_AREA_PARAM}=${encodeURIComponent(matchedArea)}`
}
